// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";

import {AssetRegistry} from "../src/AssetRegistry.sol";
import {TapeFactory} from "../src/TapeFactory.sol";
import {PerfEngineRef} from "../src/PerfEngineRef.sol";
import {IPerfEngine} from "../src/interfaces/IPerfEngine.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockStockToken} from "../src/mocks/MockStockToken.sol";
import {MockAggregator} from "../src/mocks/MockAggregator.sol";
import {MockSwapRouter} from "../src/mocks/MockSwapRouter.sol";

/// @notice Testnet deployment. Robinhood Chain testnet has no stock tokens, Chainlink stock feeds or
///         Uniswap, so we deploy ABI-identical stand-ins and mirror real mainnet prices into the feeds
///         (scripts/relay). The Stylus PerfEngine is deployed separately with cargo-stylus and passed
///         in as ENGINE; without it, the Solidity reference engine is used.
///
///   ENGINE=0x... forge script script/Deploy.s.sol --rpc-url $RH_TESTNET_RPC --broadcast
contract Deploy is Script {
    struct Listing {
        string symbol;
        string name;
        int256 price; // 8 dp, mainnet Chainlink at deploy time
        address mainnetFeed;
    }

    uint256 constant SPREAD_BPS = 25; // calibrated on mainnet NVDA/USDG fills (24-53 bps)

    MockERC20 internal usdg;
    MockSwapRouter internal router;
    AssetRegistry internal registry;
    IPerfEngine internal engine;
    TapeFactory internal factory;
    string internal assetsOut;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address engineAddr = vm.envOr("ENGINE", address(0));
        Listing[] memory l = _listings();

        vm.startBroadcast(pk);
        usdg = new MockERC20("Global Dollar (Tape testnet)", "USDG", 6, 10_000e6, deployer);
        router = new MockSwapRouter(address(usdg), SPREAD_BPS);
        usdg.setMinter(address(router), true);
        registry = new AssetRegistry(deployer, address(usdg), address(router), 26 hours, 60);
        engine = engineAddr == address(0) ? IPerfEngine(address(new PerfEngineRef())) : IPerfEngine(engineAddr);
        factory = new TapeFactory(registry, engine);
        for (uint256 i; i < l.length; ++i) {
            assetsOut = vm.serializeString("assets", l[i].symbol, _list(l[i], deployer, router, registry));
        }
        vm.stopBroadcast();

        _write(deployer, engineAddr != address(0));
    }

    function _write(address deployer, bool stylus) internal {
        string memory json = "deployment";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeAddress(json, "deployer", deployer);
        vm.serializeAddress(json, "usdg", address(usdg));
        vm.serializeAddress(json, "router", address(router));
        vm.serializeAddress(json, "registry", address(registry));
        vm.serializeAddress(json, "engine", address(engine));
        vm.serializeBool(json, "stylusEngine", stylus);
        vm.serializeAddress(json, "factory", address(factory));
        string memory out = vm.serializeString(json, "assets", assetsOut);
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(out, path);
        console2.log("wrote", path);
        console2.log("factory", address(factory));
        console2.log("engine", address(engine));
    }

    function _list(Listing memory x, address deployer, MockSwapRouter router, AssetRegistry registry)
        internal
        returns (string memory)
    {
        MockStockToken t = new MockStockToken(string.concat(x.name, " (Tape testnet)"), x.symbol, deployer);
        MockAggregator f = new MockAggregator(string.concat(x.symbol, " / USD"), x.price, deployer);
        t.setMinter(address(router), true);
        router.setFeed(address(t), address(f));
        registry.list(address(t), address(f), 500);
        vm.serializeAddress(x.symbol, "token", address(t));
        vm.serializeAddress(x.symbol, "feed", address(f));
        return vm.serializeAddress(x.symbol, "mainnetFeed", x.mainnetFeed);
    }

    function _listings() internal pure returns (Listing[] memory l) {
        l = new Listing[](11);
        l[0] = Listing("NVDA", "NVIDIA", 23042347652, 0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15);
        l[1] = Listing("AAPL", "Apple", 33240806311, 0x6B22A786bAa607d76728168703a39Ea9C99f2cD0);
        l[2] = Listing("TSLA", "Tesla", 35581080000, 0x4A1166a659A55625345e9515b32adECea5547C38);
        l[3] = Listing("MSFT", "Microsoft", 51480165091, 0x45C3C877C15E6BA2EBB19eA114Ea508d14C1Af2E);
        l[4] = Listing("META", "Meta Platforms", 72529750697, 0x7C38C00C30BEe9378381E7B6135d7283356D71b1);
        l[5] = Listing("AMZN", "Amazon", 25167500000, 0xD5a1508ceD74c084eBf3cBe853e2C968fB2a651C);
        l[6] = Listing("GOOGL", "Alphabet", 35166318285, 0xF6f373a037c30F0e5010d854385cA89185AE638b);
        l[7] = Listing("SPY", "SPDR S&P 500 ETF", 76616064980, 0x319724394D3A0e3669269846abE664Cd621f9f6A);
        l[8] = Listing("QQQ", "Invesco QQQ", 74423118545, 0x80901d846d5D7B030F26B480776EE3b29374C2ae);
        l[9] = Listing("PLTR", "Palantir", 18815795000, 0x820ABedFF239034956B7A9d2F0a331f9F075eB4c);
        l[10] = Listing("AMD", "AMD", 61850005000, 0x943A29E7ae51A4798823ca9eEd2ed533B2A22C72);
    }
}
