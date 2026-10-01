// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {AssetRegistry} from "../../src/AssetRegistry.sol";
import {TapeFactory} from "../../src/TapeFactory.sol";
import {TapeVault} from "../../src/TapeVault.sol";
import {PerfEngineRef} from "../../src/PerfEngineRef.sol";

/// @notice The same contracts we deploy on testnet, run against Robinhood Chain mainnet state:
///         real USDG, real Robinhood stock tokens, real Chainlink feeds, real Uniswap v3 pools.
///         Run with: forge test --match-path test/fork/* --fork-url $RH_MAINNET_RPC
contract MainnetForkTest is Test {
    /// Pinned so results are reproducible and RPC state is cached between runs.
    uint256 constant FORK_BLOCK = 77318794;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant ROUTER = 0xCaf681a66D020601342297493863E78C959E5cb2; // Uniswap SwapRouter02

    address constant NVDA = 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC;
    address constant AAPL = 0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9;
    address constant TSLA = 0x322F0929c4625eD5bAd873c95208D54E1c003b2d;
    address constant NVDA_FEED = 0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15;
    address constant AAPL_FEED = 0x6B22A786bAa607d76728168703a39Ea9C99f2cD0;
    address constant TSLA_FEED = 0x4A1166a659A55625345e9515b32adECea5547C38;

    address constant NVDA_USDG_POOL = 0xd4EB21209C4D6093f80B5b84f5C45cc093EA14a3; // funds test accounts

    address manager = makeAddr("manager");
    address alice = makeAddr("alice");
    TapeVault vault;
    PerfEngineRef engine;

    function setUp() public {
        vm.createSelectFork(vm.envOr("RH_MAINNET_RPC", string("https://rpc.mainnet.chain.robinhood.com")), FORK_BLOCK);
        AssetRegistry registry = new AssetRegistry(address(this), USDG, ROUTER, 4 days, 0);
        registry.list(NVDA, NVDA_FEED, 500);
        registry.list(AAPL, AAPL_FEED, 500);
        registry.list(TSLA, TSLA_FEED, 3000);
        engine = new PerfEngineRef();
        TapeFactory factory = new TapeFactory(registry, engine);

        vm.startPrank(NVDA_USDG_POOL);
        IERC20(USDG).transfer(manager, 1_000e6);
        IERC20(USDG).transfer(alice, 20_000e6);
        vm.stopPrank();

        address[] memory assets = new address[](3);
        (assets[0], assets[1], assets[2]) = (NVDA, AAPL, TSLA);
        vm.startPrank(manager);
        IERC20(USDG).approve(address(factory), 1_000e6);
        vault = factory.createVault("Mainnet Fork Fund", "tFORK", assets, 2_000, 1_000e6);
        vm.stopPrank();
    }

    function test_fullLifecycleAgainstRealLiquidity() public {
        vm.startPrank(alice);
        IERC20(USDG).approve(address(vault), 20_000e6);
        vault.deposit(20_000e6, 1, alice);
        vm.stopPrank();
        uint256 navStart = vault.totalValue();

        vm.startPrank(manager);
        uint256 nvdaOut = vault.trade(USDG, NVDA, 8_000e6, 100);
        uint256 aaplOut = vault.trade(USDG, AAPL, 6_000e6, 100);
        uint256 tslaOut = vault.trade(USDG, TSLA, 4_000e6, 100);
        vm.stopPrank();
        uint256 navAfter = vault.totalValue();

        console2.log("NVDA bought (1e18):", nvdaOut);
        console2.log("AAPL bought (1e18):", aaplOut);
        console2.log("TSLA bought (1e18):", tslaOut);
        console2.log("NAV before trades (1e18 USD):", navStart);
        console2.log("NAV after trades  (1e18 USD):", navAfter);
        console2.log("execution cost vs oracle (bps):", (navStart - navAfter) * 10_000 / navStart);
        assertGt(nvdaOut, 0);
        assertGt(navAfter, navStart * 9_900 / 10_000); // < 1% total cost across three real pools

        vm.warp(block.timestamp + 1 hours);
        vault.checkpoint();
        assertEq(engine.count(address(vault)), 2);

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        (uint256 usdgOut, uint256[] memory out) = vault.redeem(shares, alice);
        assertEq(IERC20(NVDA).balanceOf(alice), out[0]);
        assertEq(IERC20(AAPL).balanceOf(alice), out[1]);
        assertEq(IERC20(TSLA).balanceOf(alice), out[2]);
        assertGt(usdgOut, 0);
    }

    function test_guardRejectsFillsThroughTheOracle() public {
        vm.startPrank(alice);
        IERC20(USDG).approve(address(vault), 20_000e6);
        vault.deposit(20_000e6, 1, alice);
        vm.stopPrank();
        // real pools sit above the oracle; demanding a fill at or better than oracle must revert
        vm.prank(manager);
        vm.expectRevert();
        vault.trade(USDG, NVDA, 8_000e6, 0);
    }
}
