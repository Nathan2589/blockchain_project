// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentAccessPass} from "../src/AgentAccessPass.sol";
import {AgentAccessPassHandler} from "./handlers/AgentAccessPassHandler.sol";

contract AgentAccessPassInvariantTest is Test {
    AgentAccessPass internal pass;
    AgentAccessPassHandler internal handler;

    address internal venue = makeAddr("venue");

    uint256 internal constant TICKET_PRICE = 0.01 ether;
    uint256 internal constant MAX_SUPPLY = 1000;

    function setUp() public {
        vm.prank(venue);
        pass = new AgentAccessPass(TICKET_PRICE, MAX_SUPPLY);

        address[] memory actors = new address[](5);
        actors[0] = makeAddr("alice");
        actors[1] = makeAddr("bob");
        actors[2] = makeAddr("carol");
        actors[3] = makeAddr("dave");
        actors[4] = makeAddr("erin");

        handler = new AgentAccessPassHandler(pass, actors, venue);

        targetContract(address(handler));
    }

    function invariant_Solvency() public view {
        uint256 reserved = pass.totalSupply() * pass.ticketPrice();
        assertGe(address(pass).balance, reserved, "solvency violated");
    }

    function invariant_CapNotExceeded() public view {
        assertLe(pass.totalSupply(), pass.maxSupply(), "cap exceeded");
    }

    function invariant_SumOfBalancesEqualsTotalSupply() public view {
        uint256 sum;
        uint256 n = handler.actorCount();
        for (uint256 i = 0; i < n; i++) {
            sum += pass.balanceOf(handler.actorAt(i));
        }
        // Defensive: include addresses that should never hold tokens.
        sum += pass.balanceOf(address(handler));
        sum += pass.balanceOf(address(pass));
        sum += pass.balanceOf(venue);
        assertEq(sum, pass.totalSupply(), "balance accounting drift");
    }
}
