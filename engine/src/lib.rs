//! Tape PerfEngine — the on-chain track record for Tape vaults, in Rust on Arbitrum Stylus.
//!
//! Each vault appends its net-of-fee price per share (1e18 = 1.0) via `record`. History is keyed by
//! `msg_sender`, so a vault can only ever write to its own tape and nobody can edit or delete it.
//! `metrics` turns the tape into the numbers a follower cares about — total return, max drawdown,
//! volatility and Sharpe — computed on-chain, so any contract can gate on them.
//!
//! The math mirrors `contracts/src/PerfEngineRef.sol` exactly; the Foundry and Rust suites assert
//! the same fixtures.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

use alloc::vec::Vec;
use alloy_sol_types::sol;
use stylus_sdk::{
    alloy_primitives::{Address, U256, U64, U128},
    prelude::*,
};

const ONE: i128 = 1_000_000_000_000_000_000;

sol! {
    #[derive(Debug)]
    event Recorded(address indexed vault, uint256 index, uint256 pps, uint256 timestamp);
    #[derive(Debug)]
    error PpsZero();
    #[derive(Debug)]
    error PpsTooLarge();
    #[derive(Debug)]
    error IndexOutOfRange();
}

#[derive(SolidityError, Debug)]
pub enum EngineError {
    PpsZero(PpsZero),
    PpsTooLarge(PpsTooLarge),
    IndexOutOfRange(IndexOutOfRange),
}

sol_storage! {
    #[entrypoint]
    pub struct PerfEngine {
        mapping(address => Point[]) tape;
    }

    pub struct Point {
        uint128 pps;
        uint64 timestamp;
    }
}

/// Summary statistics of a price-per-share series.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Metrics {
    pub n: u128,
    /// Signed, 1e18 = 100%.
    pub total_return: i128,
    /// 1e18 = 100%.
    pub max_drawdown: u128,
    /// Population stdev of per-checkpoint simple returns, 1e18 = 100%.
    pub volatility: u128,
    /// Per-checkpoint mean return / volatility, signed 1e18.
    pub sharpe: i128,
}

fn isqrt(n: u128) -> u128 {
    if n < 2 {
        return n;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

/// Pure metrics over a pps series. Truncating integer division throughout, matching Solidity.
pub fn compute(pps: &[u128]) -> Metrics {
    let n = pps.len();
    if n < 2 {
        return Metrics { n: n as u128, ..Default::default() };
    }
    let mut peak = pps[0];
    let mut mdd: u128 = 0;
    let mut sum: i128 = 0;
    let mut rets: Vec<i128> = Vec::with_capacity(n - 1);
    for i in 1..n {
        let r = (pps[i] as i128) * ONE / (pps[i - 1] as i128) - ONE;
        rets.push(r);
        sum += r;
        if pps[i] > peak {
            peak = pps[i];
        }
        let dd = (peak - pps[i]) * (ONE as u128) / peak;
        if dd > mdd {
            mdd = dd;
        }
    }
    let m = (n - 1) as i128;
    let mean = sum / m;
    let mut acc: i128 = 0;
    for r in rets.iter() {
        let d = r - mean;
        acc += d * d / ONE;
    }
    let vol = isqrt(((acc / m) as u128) * (ONE as u128));
    let total = (pps[n - 1] as i128) * ONE / (pps[0] as i128) - ONE;
    let sharpe = if vol == 0 { 0 } else { mean * ONE / (vol as i128) };
    Metrics { n: n as u128, total_return: total, max_drawdown: mdd, volatility: vol, sharpe }
}

fn signed(x: i128) -> U256 {
    if x >= 0 {
        U256::from(x as u128)
    } else {
        U256::ZERO.wrapping_sub(U256::from(x.unsigned_abs()))
    }
}

#[public]
impl PerfEngine {
    /// Append the caller's current net-of-fee price per share.
    pub fn record(&mut self, pps: U256) -> Result<(), EngineError> {
        if pps.is_zero() {
            return Err(EngineError::PpsZero(PpsZero {}));
        }
        if pps > U256::from(u128::MAX >> 1) {
            return Err(EngineError::PpsTooLarge(PpsTooLarge {}));
        }
        let vault = self.vm().msg_sender();
        let ts = self.vm().block_timestamp();
        let index = {
            let mut tape = self.tape.setter(vault);
            let mut p = tape.grow();
            p.pps.set(U128::from(pps.to::<u128>()));
            p.timestamp.set(U64::from(ts));
            tape.len() - 1
        };
        self.vm().log(Recorded { vault, index: U256::from(index), pps, timestamp: U256::from(ts) });
        Ok(())
    }

    pub fn count(&self, vault: Address) -> U256 {
        U256::from(self.tape.getter(vault).len())
    }

    #[selector(name = "checkpointAt")]
    pub fn checkpoint_at(&self, vault: Address, index: U256) -> Result<(U256, U256), EngineError> {
        let tape = self.tape.getter(vault);
        match tape.get(index.to::<usize>()) {
            Some(p) => Ok((U256::from(p.pps.get()), U256::from(p.timestamp.get()))),
            None => Err(EngineError::IndexOutOfRange(IndexOutOfRange {})),
        }
    }

    /// (n, totalReturn, maxDrawdown, volatility, sharpe, elapsed); signed values are two's complement.
    pub fn metrics(&self, vault: Address) -> (U256, U256, U256, U256, U256, U256) {
        let tape = self.tape.getter(vault);
        let len = tape.len();
        let mut xs: Vec<u128> = Vec::with_capacity(len);
        let (mut first_ts, mut last_ts) = (0u64, 0u64);
        for i in 0..len {
            let p = tape.get(i).unwrap();
            xs.push(p.pps.get().to::<u128>());
            let ts = p.timestamp.get().to::<u64>();
            if i == 0 {
                first_ts = ts;
            }
            last_ts = ts;
        }
        let m = compute(&xs);
        let elapsed = if len < 2 { 0 } else { last_ts - first_ts };
        (
            U256::from(m.n),
            signed(m.total_return),
            U256::from(m.max_drawdown),
            U256::from(m.volatility),
            signed(m.sharpe),
            U256::from(elapsed),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use stylus_sdk::testing::*;

    const E: u128 = ONE as u128;

    #[test]
    fn fixture_matches_solidity_reference() {
        // Same fixture as contracts/test/PerfEngineRef.t.sol
        let m = compute(&[E, E * 11 / 10, E * 99 / 100, E * 121 / 100]);
        assert_eq!(m.n, 4);
        assert_eq!(m.total_return, ONE * 21 / 100);
        assert_eq!(m.max_drawdown, E / 10);
        assert_eq!(m.volatility, 132_817_933_904_008_204);
        assert_eq!(m.sharpe, 557_711_386_533_160_436);
    }

    #[test]
    fn losing_series_has_negative_sharpe() {
        let m = compute(&[E, E * 95 / 100, E * 90 / 100]);
        assert!(m.total_return < 0);
        assert!(m.sharpe < 0);
        assert_eq!(m.max_drawdown, E / 10);
    }

    #[test]
    fn flat_series_is_all_zero() {
        let m = compute(&[E, E, E]);
        assert_eq!((m.total_return, m.max_drawdown, m.volatility, m.sharpe), (0, 0, 0, 0));
    }

    #[test]
    fn tapes_are_isolated_per_sender() {
        let vm = TestVM::default();
        let mut c = PerfEngine::from(&vm);
        let a = Address::from([0xaa; 20]);
        let b = Address::from([0xbb; 20]);
        vm.set_sender(a);
        c.record(U256::from(E)).unwrap();
        c.record(U256::from(E * 2)).unwrap();
        vm.set_sender(b);
        c.record(U256::from(E)).unwrap();
        assert_eq!(c.count(a), U256::from(2));
        assert_eq!(c.count(b), U256::from(1));
        let (pps, _) = c.checkpoint_at(a, U256::from(1)).unwrap();
        assert_eq!(pps, U256::from(E * 2));
        let (_, total, ..) = c.metrics(a);
        assert_eq!(total, U256::from(E)); // +100%
    }

    #[test]
    fn rejects_zero_and_out_of_range() {
        let vm = TestVM::default();
        let mut c = PerfEngine::from(&vm);
        assert!(c.record(U256::ZERO).is_err());
        assert!(c.checkpoint_at(Address::ZERO, U256::ZERO).is_err());
    }
}
