// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {ISwapRouter02} from "../interfaces/ISwapRouter02.sol";
import {IAggregatorV3} from "../interfaces/IAggregatorV3.sol";
import {MockERC20} from "./MockERC20.sol";

/// @notice Testnet stand-in for Uniswap SwapRouter02 (same ABI). Fills at the feed price minus a
///         spread, burning what it receives and minting what it pays. Calibrated against the mainnet
///         NVDA/USDG 0.05% pool, where fills ran 24-53 bps through the oracle.
contract MockSwapRouter is ISwapRouter02 {
    using SafeERC20 for IERC20;

    address public immutable usdg;
    uint256 public spreadBps;
    address public immutable owner;
    mapping(address stock => address feed) public feedOf;

    error Unsupported();
    error TooLittleReceived();
    error NotOwner();

    constructor(address usdg_, uint256 spreadBps_) {
        usdg = usdg_;
        spreadBps = spreadBps_;
        owner = msg.sender;
    }

    function setFeed(address stock, address feed) external {
        if (msg.sender != owner) revert NotOwner();
        feedOf[stock] = feed;
    }

    function setSpread(uint256 bps) external {
        if (msg.sender != owner) revert NotOwner();
        spreadBps = bps;
    }

    function exactInputSingle(ExactInputSingleParams calldata p) external payable returns (uint256 out) {
        bool buying = p.tokenIn == usdg;
        address stock = buying ? p.tokenOut : p.tokenIn;
        if ((!buying && p.tokenOut != usdg) || feedOf[stock] == address(0)) revert Unsupported();
        (, int256 px,,,) = IAggregatorV3(feedOf[stock]).latestRoundData();

        // stock 18 dp, usdg 6 dp, px 8 dp
        out = buying
            ? Math.mulDiv(p.amountIn, 1e20, uint256(px))
            : Math.mulDiv(p.amountIn, uint256(px), 1e20);
        out = out * (10_000 - spreadBps) / 10_000;
        if (out < p.amountOutMinimum) revert TooLittleReceived();

        IERC20(p.tokenIn).safeTransferFrom(msg.sender, address(this), p.amountIn);
        MockERC20(p.tokenIn).burn(address(this), p.amountIn);
        MockERC20(p.tokenOut).mint(p.recipient, out);
    }
}
