// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAggregatorV3} from "../interfaces/IAggregatorV3.sol";

/// @notice Chainlink-shaped feed for testnet. The price relay (scripts/relay) mirrors the real
///         Robinhood Chain mainnet feed into it, so testnet NAVs track the live market.
contract MockAggregator is IAggregatorV3, Ownable {
    string public description;
    uint8 public constant decimals = 8;

    uint80 internal _round;
    int256 internal _answer;
    uint256 internal _updatedAt;
    mapping(address => bool) public isUpdater;

    error NotUpdater();

    constructor(string memory description_, int256 initial, address owner_) Ownable(owner_) {
        description = description_;
        _set(initial, block.timestamp);
    }

    function setUpdater(address u, bool on) external onlyOwner {
        isUpdater[u] = on;
    }

    function update(int256 answer) external {
        if (!isUpdater[msg.sender] && msg.sender != owner()) revert NotUpdater();
        _set(answer, block.timestamp);
    }

    /// @notice Mirror a source round with its original timestamp (must not be in the future).
    function updateAt(int256 answer, uint256 updatedAt) external {
        if (!isUpdater[msg.sender] && msg.sender != owner()) revert NotUpdater();
        _set(answer, updatedAt > block.timestamp ? block.timestamp : updatedAt);
    }

    function _set(int256 answer, uint256 at) internal {
        _round++;
        _answer = answer;
        _updatedAt = at;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (_round, _answer, _updatedAt, _updatedAt, _round);
    }
}
