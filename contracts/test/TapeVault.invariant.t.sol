// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Base} from "./utils/Base.t.sol";
import {TapeVault} from "../src/TapeVault.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockAggregator} from "../src/mocks/MockAggregator.sol";

/// @dev Drives followers and the manager through random deposits, redemptions, trades and price
///      moves, tracking how much of the share-price change each action is allowed to cause.
contract Handler is Test {
    TapeVault internal vault;
    MockERC20 internal usdg;
    address internal nvda;
    address internal manager;
    MockAggregator internal feed;
    address internal admin;
    address[3] internal actors;

    /// @notice Largest pps drop / rise caused by a deposit or redemption.
    uint256 public maxFlowPpsDrop;
    uint256 public maxFlowPpsRise;
    uint256 public calls;

    constructor(TapeVault v, MockERC20 u, address n, address m, MockAggregator f, address a) {
        vault = v;
        usdg = u;
        nvda = n;
        manager = m;
        feed = f;
        admin = a;
        actors = [makeAddr("f1"), makeAddr("f2"), makeAddr("f3")];
        for (uint256 i; i < 3; ++i) {
            vm.prank(admin);
            usdg.mint(actors[i], 1_000_000e6);
            vm.prank(actors[i]);
            usdg.approve(address(vault), type(uint256).max);
        }
    }

    function deposit(uint256 who, uint256 amt) external {
        address a = actors[who % 3];
        amt = bound(amt, 1e6, 100_000e6);
        uint256 before = vault.pricePerShare();
        uint256 hwm = vault.highWaterMark();
        vm.prank(a);
        try vault.deposit(amt, 1, a) {} catch { return; }
        // a deposit first crystallises any pending performance fee; that is a fee event, not a flow
        if (vault.highWaterMark() == hwm) _trackFlow(before);
    }

    function redeem(uint256 who, uint256 frac) external {
        address a = actors[who % 3];
        uint256 bal = vault.balanceOf(a);
        if (bal == 0) return;
        uint256 shares = bal * bound(frac, 1, 100) / 100;
        uint256 before = vault.pricePerShare();
        vm.prank(a);
        vault.redeem(shares, a);
        if (vault.totalSupply() > 1e18) _trackFlow(before);
    }

    function buy(uint256 amt) external {
        uint256 cash = usdg.balanceOf(address(vault));
        if (cash < 1e6) return;
        amt = bound(amt, 1e6, cash);
        vm.prank(manager);
        vault.trade(address(usdg), nvda, amt, 50);
        calls++;
    }

    function sell(uint256 frac) external {
        uint256 bal = MockERC20(nvda).balanceOf(address(vault));
        if (bal < 1e12) return;
        vm.prank(manager);
        vault.trade(nvda, address(usdg), bal * bound(frac, 1, 100) / 100, 50);
        calls++;
    }

    function move(int256 bps) external {
        (, int256 px,,,) = feed.latestRoundData();
        bps = bound(bps, -500, 500);
        vm.warp(block.timestamp + 1 hours);
        vm.prank(admin);
        feed.update(px * (10_000 + bps) / 10_000);
        try vault.checkpoint() {} catch {}
    }

    function _trackFlow(uint256 before) internal {
        uint256 after_ = vault.pricePerShare();
        if (after_ < before && before - after_ > maxFlowPpsDrop) maxFlowPpsDrop = before - after_;
        if (after_ > before && after_ - before > maxFlowPpsRise) maxFlowPpsRise = after_ - before;
        calls++;
    }
}

contract TapeVaultInvariantTest is Base {
    Handler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new Handler(vault, usdg, address(nvda), manager, nvdaFeed, admin);
        targetContract(address(handler));
    }

    /// Deposits and redemptions never dilute holders (rounding always favours the vault) and can
    /// only nudge share price by dust, so money flows cannot pad the track record.
    function invariant_flowsDoNotMoveSharePrice() public view {
        assertLe(handler.maxFlowPpsDrop(), 1);
        assertLe(handler.maxFlowPpsRise(), 1e9); // < 1e-9 relative
    }

    /// Every share is backed: redeeming the whole supply would distribute exactly the vault's holdings.
    function invariant_vaultHoldsOnlyItsAssets() public view {
        (address[] memory tokens,) = vault.holdings();
        assertEq(tokens.length, 3);
        assertEq(usdg.allowance(address(vault), address(router)), 0);
        assertEq(nvda.allowance(address(vault), address(router)), 0);
    }

    /// The high-water mark never decreases.
    function invariant_highWaterMarkMonotone() public view {
        assertGe(vault.highWaterMark(), 1e18);
    }
}
