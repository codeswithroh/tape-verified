// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {PerfEngineRef} from "../src/PerfEngineRef.sol";

/// @dev Same fixture and expected values as engine/src/lib.rs `fixture_matches_solidity_reference`.
contract PerfEngineRefTest is Test {
    PerfEngineRef engine = new PerfEngineRef();

    function test_fixtureMatchesStylusEngine() public {
        uint256[4] memory pps = [uint256(1e18), 1.1e18, 0.99e18, 1.21e18];
        for (uint256 i; i < 4; ++i) {
            vm.warp(1_000 + i * 1 days);
            engine.record(pps[i]);
        }
        (uint256 n, uint256 total, uint256 mdd, uint256 vol, uint256 sharpe, uint256 elapsed) =
            engine.metrics(address(this));
        assertEq(n, 4);
        assertEq(total, 0.21e18);
        assertEq(mdd, 0.1e18);
        assertEq(vol, 132_817_933_904_008_204);
        assertEq(sharpe, 557_711_386_533_160_436);
        assertEq(elapsed, 3 days);
    }

    function test_negativeValuesAreTwosComplement() public {
        engine.record(1e18);
        engine.record(0.9e18);
        (, uint256 total,,, uint256 sharpe,) = engine.metrics(address(this));
        assertEq(int256(total), -0.1e18);
        assertEq(int256(sharpe), 0); // single return has zero variance
    }

    function test_rejectsZero() public {
        vm.expectRevert(PerfEngineRef.PpsZero.selector);
        engine.record(0);
    }
}
