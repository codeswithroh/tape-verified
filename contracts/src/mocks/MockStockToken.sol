// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MockERC20} from "./MockERC20.sol";

/// @notice Testnet stand-in for a Robinhood Stock Token: 18 dp ERC-20 with the ERC-8056 multiplier.
contract MockStockToken is MockERC20 {
    uint256 public uiMultiplier = 1e18;

    event MultiplierUpdated(uint256 oldMultiplier, uint256 newMultiplier);

    constructor(string memory n, string memory s, address owner_) MockERC20(n, s, 18, 0, owner_) {}

    function setUiMultiplier(uint256 m) external onlyOwner {
        emit MultiplierUpdated(uiMultiplier, m);
        uiMultiplier = m;
    }
}
