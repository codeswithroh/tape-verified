// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";

/// @title AssetRegistry
/// @notice Curated list of stock tokens a Tape vault may hold, each bound to its Chainlink feed
///         and the Uniswap fee tier of its USDG pool. Only tokens with a live feed can be listed,
///         because a portfolio we cannot price is a track record we cannot verify.
contract AssetRegistry is Ownable {
    struct Asset {
        address feed;
        uint24 poolFee;
        bool listed;
    }

    address public immutable usdg;
    address public immutable router;

    /// @notice Max age of a feed answer before pricing-dependent actions halt.
    /// Robinhood stock feeds are 24/5 with a 24h heartbeat, so this also halts deposits over weekends.
    uint256 public maxStaleness;
    /// @notice Minimum spacing between track-record checkpoints of one vault.
    uint256 public minCheckpointInterval;
    /// @notice Receives vault entry fees. Kept out of the vault so deposits never move share price.
    address public feeRecipient;

    mapping(address token => Asset) internal _assets;
    address[] internal _listed;

    event AssetListed(address indexed token, address indexed feed, uint24 poolFee);
    event AssetDelisted(address indexed token);
    event ParamsSet(uint256 maxStaleness, uint256 minCheckpointInterval);
    event FeeRecipientSet(address feeRecipient);

    error ZeroAddress();
    error BadFeed();
    error AlreadyListed();
    error NotListed();

    constructor(address owner_, address usdg_, address router_, uint256 maxStaleness_, uint256 minInterval_)
        Ownable(owner_)
    {
        if (usdg_ == address(0) || router_ == address(0)) revert ZeroAddress();
        usdg = usdg_;
        router = router_;
        maxStaleness = maxStaleness_;
        minCheckpointInterval = minInterval_;
        feeRecipient = owner_;
        emit ParamsSet(maxStaleness_, minInterval_);
        emit FeeRecipientSet(owner_);
    }

    function list(address token, address feed, uint24 poolFee) external onlyOwner {
        if (token == address(0) || feed == address(0) || token == usdg) revert ZeroAddress();
        if (_assets[token].listed) revert AlreadyListed();
        if (IAggregatorV3(feed).decimals() != 8) revert BadFeed();
        _assets[token] = Asset(feed, poolFee, true);
        _listed.push(token);
        emit AssetListed(token, feed, poolFee);
    }

    /// @notice Delisting blocks new vaults from adding the token; existing vaults keep pricing it.
    function delist(address token) external onlyOwner {
        if (!_assets[token].listed) revert NotListed();
        _assets[token].listed = false;
        emit AssetDelisted(token);
    }

    function setParams(uint256 maxStaleness_, uint256 minInterval_) external onlyOwner {
        maxStaleness = maxStaleness_;
        minCheckpointInterval = minInterval_;
        emit ParamsSet(maxStaleness_, minInterval_);
    }

    function setFeeRecipient(address r) external onlyOwner {
        if (r == address(0)) revert ZeroAddress();
        feeRecipient = r;
        emit FeeRecipientSet(r);
    }

    function asset(address token) external view returns (Asset memory) {
        return _assets[token];
    }

    function isListed(address token) external view returns (bool) {
        return _assets[token].listed;
    }

    function feedOf(address token) external view returns (address) {
        return _assets[token].feed;
    }

    function listedTokens() external view returns (address[] memory) {
        return _listed;
    }
}
