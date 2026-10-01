// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AssetRegistry} from "../../src/AssetRegistry.sol";
import {TapeFactory} from "../../src/TapeFactory.sol";
import {TapeVault} from "../../src/TapeVault.sol";
import {PerfEngineRef} from "../../src/PerfEngineRef.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {MockStockToken} from "../../src/mocks/MockStockToken.sol";
import {MockAggregator} from "../../src/mocks/MockAggregator.sol";
import {MockSwapRouter} from "../../src/mocks/MockSwapRouter.sol";

abstract contract Base is Test {
    address internal admin = makeAddr("admin");
    address internal manager = makeAddr("manager");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    MockERC20 internal usdg;
    MockStockToken internal nvda;
    MockStockToken internal spy;
    MockAggregator internal nvdaFeed;
    MockAggregator internal spyFeed;
    MockSwapRouter internal router;
    AssetRegistry internal registry;
    PerfEngineRef internal engine;
    TapeFactory internal factory;
    TapeVault internal vault;

    uint256 internal constant SPREAD_BPS = 25;

    function setUp() public virtual {
        vm.warp(1_790_000_000);
        vm.startPrank(admin);
        usdg = new MockERC20("Global Dollar", "USDG", 6, 1_000e6, admin);
        nvda = new MockStockToken("NVIDIA", "NVDA", admin);
        spy = new MockStockToken("SPDR S&P 500", "SPY", admin);
        nvdaFeed = new MockAggregator("NVDA / USD", 230e8, admin);
        spyFeed = new MockAggregator("SPY / USD", 766e8, admin);

        router = new MockSwapRouter(address(usdg), SPREAD_BPS);
        router.setFeed(address(nvda), address(nvdaFeed));
        router.setFeed(address(spy), address(spyFeed));
        usdg.setMinter(address(router), true);
        nvda.setMinter(address(router), true);
        spy.setMinter(address(router), true);

        registry = new AssetRegistry(admin, address(usdg), address(router), 26 hours, 1 hours);
        registry.list(address(nvda), address(nvdaFeed), 500);
        registry.list(address(spy), address(spyFeed), 500);
        engine = new PerfEngineRef();
        factory = new TapeFactory(registry, engine);

        usdg.mint(manager, 100_000e6);
        usdg.mint(alice, 100_000e6);
        usdg.mint(bob, 100_000e6);
        vm.stopPrank();

        vault = _createVault(manager, 2_000, 1_000e6);
    }

    function _assets() internal view returns (address[] memory a) {
        a = new address[](2);
        a[0] = address(nvda);
        a[1] = address(spy);
    }

    function _createVault(address who, uint16 feeBps, uint256 seed) internal returns (TapeVault v) {
        vm.startPrank(who);
        usdg.approve(address(factory), seed);
        v = factory.createVault("Alpha Fund", "tALPHA", _assets(), feeBps, seed);
        vm.stopPrank();
    }

    function _deposit(address who, uint256 amount) internal returns (uint256 shares) {
        vm.startPrank(who);
        usdg.approve(address(vault), amount);
        shares = vault.deposit(amount, 1, who);
        vm.stopPrank();
    }

    function _setPrice(MockAggregator feed, int256 px) internal {
        vm.prank(admin);
        feed.update(px);
    }

    function _buy(address stock, uint256 usdgIn) internal returns (uint256) {
        vm.prank(manager);
        return vault.trade(address(usdg), stock, usdgIn, 50);
    }
}
