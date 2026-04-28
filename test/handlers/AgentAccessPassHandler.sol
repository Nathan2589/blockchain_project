// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentAccessPass} from "../../src/AgentAccessPass.sol";

contract AgentAccessPassHandler is Test {
    AgentAccessPass public immutable pass;
    address public immutable venue;
    uint256 public immutable ticketPrice;
    address[] public actors;

    constructor(AgentAccessPass _pass, address[] memory _actors, address _venue) {
        pass = _pass;
        venue = _venue;
        ticketPrice = _pass.ticketPrice();
        actors = _actors;
    }

    function actorAt(uint256 i) external view returns (address) {
        return actors[i % actors.length];
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function _pick(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function purchase(uint256 actorSeed, uint256 quantity) external {
        address actor = _pick(actorSeed);
        quantity = bound(quantity, 1, 20);
        uint256 cost = quantity * ticketPrice;
        vm.deal(actor, actor.balance + cost);
        vm.prank(actor);
        pass.purchaseTicket{value: cost}(quantity);
    }

    function returnTicket(uint256 actorSeed, uint256 quantity) external {
        address actor = _pick(actorSeed);
        uint256 held = pass.balanceOf(actor);
        if (held == 0) return;
        quantity = bound(quantity, 1, held);
        vm.prank(actor);
        pass.returnTicket(quantity);
    }

    function transferTokens(uint256 fromSeed, uint256 toSeed, uint256 amount) external {
        address from = _pick(fromSeed);
        address to = _pick(toSeed);
        uint256 held = pass.balanceOf(from);
        if (held == 0) return;
        amount = bound(amount, 1, held);
        vm.prank(from);
        pass.transfer(to, amount);
    }

    function withdraw() external {
        vm.prank(venue);
        pass.withdraw();
    }

    function donateEth(uint256 amount) external {
        amount = bound(amount, 0, 10 ether);
        vm.deal(address(pass), address(pass).balance + amount);
    }
}
