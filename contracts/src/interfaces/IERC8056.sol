// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice ERC-8056 scaled UI amount extension exposed by Robinhood Stock Tokens.
interface IERC8056 {
    function uiMultiplier() external view returns (uint256);
}
