// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Track-record engine (Stylus/Rust in production, Solidity reference for tests).
/// History is keyed by msg.sender, so a vault can only ever append to its own record.
interface IPerfEngine {
    /// @param pps net-of-fee price per share, 1e18 = 1.0
    function record(uint256 pps) external;

    function count(address vault) external view returns (uint256);

    function checkpointAt(address vault, uint256 index) external view returns (uint256 pps, uint256 timestamp);

    /// @return n checkpoints
    /// @return totalReturn signed 1e18 (two's complement in uint256)
    /// @return maxDrawdown 1e18
    /// @return volatility per-period stdev 1e18
    /// @return sharpe per-period mean/stdev, signed 1e18 (two's complement)
    /// @return elapsed seconds between first and last checkpoint
    function metrics(address vault)
        external
        view
        returns (
            uint256 n,
            uint256 totalReturn,
            uint256 maxDrawdown,
            uint256 volatility,
            uint256 sharpe,
            uint256 elapsed
        );
}
