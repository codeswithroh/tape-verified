// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPerfEngine} from "./interfaces/IPerfEngine.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title PerfEngineRef
/// @notice Solidity reference of the Stylus PerfEngine (engine/src/lib.rs). Same storage model and
///         math, bit-for-bit. Used by the Foundry suite and as the baseline in the gas benchmark.
contract PerfEngineRef is IPerfEngine {
    int256 internal constant ONE = 1e18;

    struct Point {
        uint128 pps;
        uint64 timestamp;
    }

    mapping(address vault => Point[]) internal _tape;

    event Recorded(address indexed vault, uint256 index, uint256 pps, uint256 timestamp);

    error PpsZero();

    function record(uint256 pps) external {
        if (pps == 0) revert PpsZero();
        Point[] storage t = _tape[msg.sender];
        t.push(Point(uint128(pps), uint64(block.timestamp)));
        emit Recorded(msg.sender, t.length - 1, pps, block.timestamp);
    }

    function count(address vault) external view returns (uint256) {
        return _tape[vault].length;
    }

    function checkpointAt(address vault, uint256 index) external view returns (uint256, uint256) {
        Point memory p = _tape[vault][index];
        return (p.pps, p.timestamp);
    }

    function metrics(address vault)
        external
        view
        returns (uint256 n, uint256 totalReturn, uint256 maxDrawdown, uint256 volatility, uint256 sharpe, uint256 elapsed)
    {
        Point[] storage t = _tape[vault];
        n = t.length;
        if (n < 2) return (n, 0, 0, 0, 0, 0);

        int256 mean;
        (mean, maxDrawdown, volatility) = _stats(t);
        totalReturn = uint256(int256(uint256(t[n - 1].pps)) * ONE / int256(uint256(t[0].pps)) - ONE);
        sharpe = volatility == 0 ? 0 : uint256(mean * ONE / int256(volatility));
        elapsed = t[n - 1].timestamp - t[0].timestamp;
    }

    /// @dev Mean and population stdev of per-checkpoint simple returns, plus max drawdown.
    function _stats(Point[] storage t) internal view returns (int256 mean, uint256 mdd, uint256 vol) {
        uint256 n = t.length;
        int256[] memory rets = new int256[](n - 1);
        uint256 peak = t[0].pps;
        uint256 prev = peak;
        int256 sum;
        for (uint256 i = 1; i < n; ++i) {
            uint256 cur = t[i].pps;
            int256 r = int256(cur) * ONE / int256(prev) - ONE;
            rets[i - 1] = r;
            sum += r;
            if (cur > peak) peak = cur;
            uint256 dd = (peak - cur) * uint256(ONE) / peak;
            if (dd > mdd) mdd = dd;
            prev = cur;
        }
        int256 m = int256(n - 1);
        mean = sum / m;
        int256 acc;
        for (uint256 i; i < rets.length; ++i) {
            int256 d = rets[i] - mean;
            acc += d * d / ONE;
        }
        vol = Math.sqrt(uint256(acc / m) * uint256(ONE));
    }
}
