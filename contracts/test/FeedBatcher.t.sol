// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {FeedBatcher} from "../src/mocks/FeedBatcher.sol";
import {MockAggregator} from "../src/mocks/MockAggregator.sol";

contract FeedBatcherTest is Test {
    function test_pushUpdatesAllFeedsOnlyForRelayer() public {
        address relayer = makeAddr("relayer");
        FeedBatcher b = new FeedBatcher(relayer);
        MockAggregator[] memory fs = new MockAggregator[](2);
        fs[0] = new MockAggregator("A", 1e8, address(this));
        fs[1] = new MockAggregator("B", 2e8, address(this));
        fs[0].setUpdater(address(b), true);
        fs[1].setUpdater(address(b), true);
        int256[] memory px = new int256[](2);
        (px[0], px[1]) = (3e8, 4e8);

        vm.expectRevert(FeedBatcher.NotRelayer.selector);
        b.push(fs, px);

        vm.prank(relayer);
        b.push(fs, px);
        (, int256 a,,,) = fs[0].latestRoundData();
        (, int256 c,,,) = fs[1].latestRoundData();
        assertEq(a, 3e8);
        assertEq(c, 4e8);
    }
}
