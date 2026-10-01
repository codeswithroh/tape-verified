// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MockAggregator} from "./MockAggregator.sol";

/// @notice Testnet relay helper: pushes many mirrored mainnet prices in one transaction, so the
///         serverless relay never races itself on nonces. Must be an updater on each feed.
contract FeedBatcher {
    address public immutable relayer;

    error NotRelayer();
    error LengthMismatch();

    constructor(address relayer_) {
        relayer = relayer_;
    }

    function push(MockAggregator[] calldata feeds, int256[] calldata answers) external {
        if (msg.sender != relayer) revert NotRelayer();
        if (feeds.length != answers.length) revert LengthMismatch();
        for (uint256 i; i < feeds.length; ++i) feeds[i].update(answers[i]);
    }
}
