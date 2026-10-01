// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Base} from "./utils/Base.t.sol";
import {TapeVault} from "../src/TapeVault.sol";
import {TapeFactory} from "../src/TapeFactory.sol";

contract TapeVaultTest is Base {
    // ---------------------------------------------------------------- creation

    function test_factorySeedsAndStampsGenesis() public view {
        assertEq(vault.manager(), manager);
        assertEq(vault.balanceOf(manager), 1_000e18 * (10_000 - 20) / 10_000);
        assertEq(engine.count(address(vault)), 1);
        (uint256 pps,) = engine.checkpointAt(address(vault), 0);
        assertEq(pps, 1e18);
        assertTrue(factory.isVault(address(vault)));
        assertEq(factory.vaultsOf(manager)[0], address(vault));
    }

    function test_createRejectsSmallSeed() public {
        vm.startPrank(manager);
        usdg.approve(address(factory), 1e6);
        vm.expectRevert(TapeFactory.SeedTooSmall.selector);
        factory.createVault("x", "x", _assets(), 0, 1e6);
        vm.stopPrank();
    }

    function test_createRejectsUnlistedAndDuplicateAssets() public {
        address[] memory a = new address[](2);
        a[0] = address(nvda);
        a[1] = address(nvda);
        vm.startPrank(manager);
        usdg.approve(address(factory), 10e6);
        vm.expectRevert(abi.encodeWithSelector(TapeVault.BadAsset.selector, address(nvda)));
        factory.createVault("x", "x", a, 0, 10e6);
        a[1] = address(usdg);
        vm.expectRevert(abi.encodeWithSelector(TapeVault.BadAsset.selector, address(usdg)));
        factory.createVault("x", "x", a, 0, 10e6);
        vm.stopPrank();
    }

    function test_createRejectsExcessiveFee() public {
        vm.startPrank(manager);
        usdg.approve(address(factory), 10e6);
        vm.expectRevert(TapeVault.FeeTooHigh.selector);
        factory.createVault("x", "x", _assets(), 3_001, 10e6);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------- deposits

    function test_depositAtNavChargesEntryFee() public {
        _buy(address(nvda), 500e6);
        uint256 navBefore = vault.totalValue();
        uint256 ppsBefore = vault.pricePerShare();
        uint256 shares = _deposit(alice, 1_000e6);
        // shares worth 99.8% of the deposit at pre-deposit pps
        assertApproxEqRel(shares * ppsBefore / 1e18, 998e18, 1e12);
        // deposits never move share price (no dilution, no track-record padding)
        assertApproxEqAbs(vault.pricePerShare(), ppsBefore, 1);
        assertEq(vault.totalValue(), navBefore + 998e18);
        assertEq(usdg.balanceOf(registry.feeRecipient()), 2e6 + 2e6); // seed + this deposit
    }

    function test_depositSlippageGuard() public {
        vm.startPrank(alice);
        usdg.approve(address(vault), 100e6);
        vm.expectRevert();
        vault.deposit(100e6, 200e18, alice);
        vm.stopPrank();
    }

    function test_depositBlockedWhenHeldPriceIsStale() public {
        _buy(address(nvda), 500e6);
        vm.warp(block.timestamp + 27 hours);
        vm.startPrank(alice);
        usdg.approve(address(vault), 100e6);
        vm.expectRevert(abi.encodeWithSelector(TapeVault.StalePrice.selector, address(nvda)));
        vault.deposit(100e6, 1, alice);
        vm.stopPrank();
    }

    function test_staleFeedOfUnheldAssetDoesNotBlock() public {
        // vault holds only USDG; feeds going stale is irrelevant
        vm.warp(block.timestamp + 30 days);
        _deposit(alice, 100e6);
    }

    // ---------------------------------------------------------------- redemption

    function test_redeemIsProRataInKind() public {
        _deposit(alice, 1_000e6);
        _buy(address(nvda), 800e6);
        _buy(address(spy), 400e6);
        uint256 shares = vault.balanceOf(alice);
        uint256 supply = vault.totalSupply();
        (, uint256[] memory bals) = vault.holdings();

        vm.prank(alice);
        (uint256 usdgOut, uint256[] memory out) = vault.redeem(shares, alice);

        assertEq(usdgOut, bals[0] * shares / supply);
        assertEq(out[0], bals[1] * shares / supply);
        assertEq(out[1], bals[2] * shares / supply);
        assertEq(nvda.balanceOf(alice), out[0]);
        assertEq(vault.balanceOf(alice), 0);
    }

    function test_redeemWorksWithStaleAndBrokenOracles() public {
        _deposit(alice, 1_000e6);
        _buy(address(nvda), 1_000e6);
        vm.warp(block.timestamp + 90 days);
        _setPrice(nvdaFeed, 0); // feed broken outright
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.redeem(shares, alice);
        assertGt(nvda.balanceOf(alice), 0);
    }

    function test_cannotRedeemOthersShares() public {
        _deposit(alice, 1_000e6);
        vm.prank(bob);
        vm.expectRevert();
        vault.redeem(1e18, bob);
    }

    // ---------------------------------------------------------------- trading

    function test_onlyManagerTrades() public {
        vm.prank(alice);
        vm.expectRevert(TapeVault.NotManager.selector);
        vault.trade(address(usdg), address(nvda), 1e6, 50);
    }

    function test_tradeFillsNearOracle() public {
        uint256 out = _buy(address(nvda), 230e6);
        // 230 USDG at $230 = 1 NVDA, minus 25 bps spread
        assertEq(out, 1e18 * (10_000 - SPREAD_BPS) / 10_000);
        vm.prank(manager);
        uint256 back = vault.trade(address(nvda), address(usdg), out, 50);
        assertApproxEqAbs(back, 230e6 * (10_000 - SPREAD_BPS) ** 2 / 1e8, 1);
    }

    function test_tradeRevertsBeyondDeviation() public {
        vm.prank(admin);
        router.setSpread(80); // venue fills 80 bps through the oracle
        vm.prank(manager);
        vm.expectRevert();
        vault.trade(address(usdg), address(nvda), 100e6, 50);
    }

    function test_tradeDeviationCapIsHard() public {
        vm.prank(manager);
        vm.expectRevert(TapeVault.DeviationTooHigh.selector);
        vault.trade(address(usdg), address(nvda), 100e6, 151);
    }

    function test_tradeRejectsAssetsOutsideTheVault() public {
        address[] memory a = new address[](1);
        a[0] = address(spy);
        TapeVault spyOnly;
        vm.startPrank(bob);
        usdg.approve(address(factory), 10e6);
        spyOnly = factory.createVault("SPY only", "tSPY", a, 0, 10e6);
        vm.expectRevert(abi.encodeWithSelector(TapeVault.BadAsset.selector, address(nvda)));
        spyOnly.trade(address(usdg), address(nvda), 1e6, 50);
        // stock -> stock is not a route
        vm.expectRevert(abi.encodeWithSelector(TapeVault.BadAsset.selector, address(nvda)));
        spyOnly.trade(address(spy), address(nvda), 1e6, 50);
        vm.stopPrank();
    }

    function test_tradeBlockedOnStalePrice() public {
        vm.warp(block.timestamp + 27 hours);
        vm.prank(manager);
        vm.expectRevert(abi.encodeWithSelector(TapeVault.StalePrice.selector, address(nvda)));
        vault.trade(address(usdg), address(nvda), 100e6, 50);
    }

    function test_routerAllowanceClearedAfterTrade() public {
        _buy(address(nvda), 100e6);
        assertEq(usdg.allowance(address(vault), address(router)), 0);
    }

    // ---------------------------------------------------------------- fees & tape

    function test_feeOnlyAboveHighWaterMark() public {
        _deposit(alice, 9_000e6);
        _buy(address(nvda), 9_000e6);

        _setPrice(nvdaFeed, 253e8); // +10%
        vm.warp(block.timestamp + 1 hours);
        _setPrice(nvdaFeed, 253e8);
        uint256 mgrBefore = vault.balanceOf(manager);
        vault.checkpoint();
        uint256 feeShares = vault.balanceOf(manager) - mgrBefore;
        assertGt(feeShares, 0);
        uint256 hwm = vault.highWaterMark();
        assertEq(hwm, vault.pricePerShare());

        // drawdown then recovery to the same mark: no new fee
        vm.warp(block.timestamp + 1 hours);
        _setPrice(nvdaFeed, 220e8);
        vault.checkpoint();
        vm.warp(block.timestamp + 1 hours);
        _setPrice(nvdaFeed, 253e8);
        uint256 mgrMid = vault.balanceOf(manager);
        vault.checkpoint();
        assertEq(vault.balanceOf(manager), mgrMid);
        assertEq(vault.highWaterMark(), hwm);
    }

    function test_feeIsTwentyPercentOfGain() public {
        _deposit(alice, 9_000e6);
        _buy(address(nvda), 9_000e6);
        uint256 hwm = vault.highWaterMark(); // 1.0; the buy's spread put pps below it
        uint256 supply = vault.totalSupply();
        vm.warp(block.timestamp + 1 hours);
        _setPrice(nvdaFeed, 276e8); // +20% on the NVDA sleeve
        uint256 grossValue = vault.totalValue();
        vault.checkpoint();
        uint256 gain = (grossValue * 1e18 / supply - hwm) * supply / 1e18;
        uint256 feeShares = vault.totalSupply() - supply;
        uint256 feeValue = feeShares * grossValue / vault.totalSupply();
        assertApproxEqRel(feeValue, gain * 2_000 / 10_000, 1e12);
    }

    function test_checkpointRateLimitedAndRecordsNetPps() public {
        vm.expectRevert(TapeVault.CheckpointTooSoon.selector);
        vault.checkpoint();
        vm.warp(block.timestamp + 1 hours);
        uint256 pps = vault.checkpoint();
        (uint256 recorded,) = engine.checkpointAt(address(vault), 1);
        assertEq(recorded, pps);
    }

    function test_trackRecordMetricsEndToEnd() public {
        _deposit(alice, 9_000e6);
        _buy(address(nvda), 9_980e6);
        int80[5] memory path = [int80(240e8), 230e8, 250e8, 225e8, 260e8];
        for (uint256 i; i < path.length; ++i) {
            vm.warp(block.timestamp + 1 days);
            _setPrice(nvdaFeed, path[i]);
            vault.checkpoint();
        }
        (uint256 n, uint256 total, uint256 mdd, uint256 vol, uint256 sharpe, uint256 elapsed) =
            engine.metrics(address(vault));
        assertEq(n, 6);
        assertGt(int256(total), 0);
        assertGt(mdd, 0.09e18); // 250 -> 225 is a 10% drawdown on the stock sleeve
        assertGt(vol, 0);
        assertGt(int256(sharpe), 0);
        assertEq(elapsed, 5 days);
    }

    function test_engineIsolatesVaults() public {
        vm.prank(alice);
        engine.record(5e18); // a rogue caller writes only to its own tape
        assertEq(engine.count(address(vault)), 1);
        assertEq(engine.count(alice), 1);
    }

    // ---------------------------------------------------------------- fuzz

    function testFuzz_depositRedeemNeverProfitsWithoutPriceMove(uint256 amount) public {
        amount = bound(amount, 1e6, 50_000e6);
        _buy(address(nvda), 500e6);
        uint256 before = usdg.balanceOf(alice);
        uint256 shares = _deposit(alice, amount);
        vm.prank(alice);
        (uint256 usdgOut, uint256[] memory out) = vault.redeem(shares, alice);
        uint256 got = usdgOut * 1e12 + out[0] * 230; // value received in 1e18 USD at $230
        assertLe(got, (before - usdg.balanceOf(alice) + usdgOut) * 1e12);
        assertLe(got, amount * 1e12);
    }

    function testFuzz_managerTradesCannotDrainFollowers(uint256 buyAmt) public {
        _deposit(alice, 10_000e6);
        buyAmt = bound(buyAmt, 1e6, 10_978e6); // seed 998 + deposit 9_980 net of entry fee
        uint256 valueBefore = vault.totalValue();
        _buy(address(nvda), buyAmt);
        uint256 valueAfter = vault.totalValue();
        // only the spread can be lost to a trade at oracle price; manager cannot extract value
        assertGe(valueAfter, valueBefore - valueBefore * (SPREAD_BPS + 1) / 10_000);
    }
}
