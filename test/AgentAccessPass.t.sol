// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentAccessPass} from "../src/AgentAccessPass.sol";
import {ReentrantAttacker} from "./mocks/ReentrantAttacker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract NoReceive {}

contract AgentAccessPassTest is Test {
    AgentAccessPass internal pass;

    address internal venue = makeAddr("venue");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant TICKET_PRICE = 0.01 ether;
    uint256 internal constant MAX_SUPPLY = 1000;

    event TicketPurchased(address indexed buyer, uint256 quantity, uint256 amountPaid);
    event TicketReturned(address indexed holder, uint256 quantity, uint256 amountRefunded);
    event Withdrawn(address indexed venue, uint256 amount);
    event Transfer(address indexed from, address indexed to, uint256 value);

    function setUp() public {
        vm.prank(venue);
        pass = new AgentAccessPass(TICKET_PRICE, MAX_SUPPLY);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // ---------- Constructor / metadata ----------

    function test_Constructor_SetsImmutables() public view {
        assertEq(pass.ticketPrice(), TICKET_PRICE, "ticketPrice");
        assertEq(pass.maxSupply(), MAX_SUPPLY, "maxSupply");
        assertEq(pass.venue(), venue, "venue");
    }

    function test_Constructor_SetsTokenMetadata() public view {
        assertEq(pass.name(), "Agent Access Pass");
        assertEq(pass.symbol(), "AAP");
    }

    function test_Constructor_DecimalsIsZero() public view {
        assertEq(pass.decimals(), 0);
    }

    // ---------- purchaseTicket ----------

    function test_PurchaseTicket_HappyPath() public {
        vm.prank(alice);
        pass.purchaseTicket{value: 5 * TICKET_PRICE}(5);

        assertEq(pass.balanceOf(alice), 5);
        assertEq(pass.totalSupply(), 5);
        assertEq(address(pass).balance, 5 * TICKET_PRICE);
    }

    function test_PurchaseTicket_EmitsTicketPurchasedAndTransfer() public {
        vm.expectEmit(true, true, false, true);
        emit Transfer(address(0), alice, 3);
        vm.expectEmit(true, false, false, true);
        emit TicketPurchased(alice, 3, 3 * TICKET_PRICE);

        vm.prank(alice);
        pass.purchaseTicket{value: 3 * TICKET_PRICE}(3);
    }

    function test_PurchaseTicket_RevertsOnZeroQuantity() public {
        vm.prank(alice);
        vm.expectRevert("AAP: quantity zero");
        pass.purchaseTicket{value: 0}(0);
    }

    function test_PurchaseTicket_RevertsOnUnderpayment() public {
        vm.prank(alice);
        vm.expectRevert("AAP: incorrect payment");
        pass.purchaseTicket{value: 5 * TICKET_PRICE - 1}(5);
    }

    function test_PurchaseTicket_RevertsOnOverpayment() public {
        vm.prank(alice);
        vm.expectRevert("AAP: incorrect payment");
        pass.purchaseTicket{value: 5 * TICKET_PRICE + 1}(5);
    }

    function test_PurchaseTicket_RevertsOnExceedsMaxSupply() public {
        vm.deal(alice, (MAX_SUPPLY + 1) * TICKET_PRICE);
        vm.prank(alice);
        vm.expectRevert("AAP: exceeds max supply");
        pass.purchaseTicket{value: (MAX_SUPPLY + 1) * TICKET_PRICE}(MAX_SUPPLY + 1);
    }

    function test_PurchaseTicket_ExactCapSucceeds_PlusOneReverts() public {
        vm.deal(alice, MAX_SUPPLY * TICKET_PRICE);
        vm.prank(alice);
        pass.purchaseTicket{value: MAX_SUPPLY * TICKET_PRICE}(MAX_SUPPLY);
        assertEq(pass.totalSupply(), MAX_SUPPLY);

        vm.deal(bob, TICKET_PRICE);
        vm.prank(bob);
        vm.expectRevert("AAP: exceeds max supply");
        pass.purchaseTicket{value: TICKET_PRICE}(1);
    }

    // ---------- returnTicket ----------

    function _buy(address buyer, uint256 quantity) internal {
        vm.prank(buyer);
        pass.purchaseTicket{value: quantity * TICKET_PRICE}(quantity);
    }

    function test_ReturnTicket_HappyPath() public {
        _buy(alice, 5);
        uint256 aliceEthBefore = alice.balance;

        vm.prank(alice);
        pass.returnTicket(2);

        assertEq(pass.balanceOf(alice), 3);
        assertEq(pass.totalSupply(), 3);
        assertEq(address(pass).balance, 3 * TICKET_PRICE);
        assertEq(alice.balance, aliceEthBefore + 2 * TICKET_PRICE);
    }

    function test_ReturnTicket_EmitsTicketReturnedAndTransfer() public {
        _buy(alice, 5);

        vm.expectEmit(true, true, false, true);
        emit Transfer(alice, address(0), 2);
        vm.expectEmit(true, false, false, true);
        emit TicketReturned(alice, 2, 2 * TICKET_PRICE);

        vm.prank(alice);
        pass.returnTicket(2);
    }

    function test_ReturnTicket_RevertsOnZeroQuantity() public {
        _buy(alice, 1);
        vm.prank(alice);
        vm.expectRevert("AAP: quantity zero");
        pass.returnTicket(0);
    }

    function test_ReturnTicket_RevertsOnInsufficientBalance() public {
        _buy(alice, 2);
        vm.prank(alice);
        vm.expectRevert("AAP: insufficient balance");
        pass.returnTicket(3);
    }

    function test_ReturnTicket_RevertsAndPreservesStateWhenRecipientRejectsETH() public {
        // Alice buys, transfers to a contract with no receive() so the refund call
        // will fail. The whole tx must revert and state must be preserved.
        _buy(alice, 2);
        NoReceive evil = new NoReceive();
        vm.prank(alice);
        assertTrue(pass.transfer(address(evil), 2));

        uint256 supplyBefore = pass.totalSupply();
        uint256 evilTokensBefore = pass.balanceOf(address(evil));
        uint256 contractEthBefore = address(pass).balance;

        vm.prank(address(evil));
        vm.expectRevert("AAP: refund failed");
        pass.returnTicket(2);

        assertEq(pass.totalSupply(), supplyBefore);
        assertEq(pass.balanceOf(address(evil)), evilTokensBefore);
        assertEq(address(pass).balance, contractEthBefore);
    }

    // ---------- verifyHolder ----------

    function test_VerifyHolder_TrueWhenBalanceMet() public {
        _buy(alice, 5);
        assertTrue(pass.verifyHolder(alice, 5));
        assertTrue(pass.verifyHolder(alice, 1));
    }

    function test_VerifyHolder_FalseWhenBalanceUnder() public {
        _buy(alice, 2);
        assertFalse(pass.verifyHolder(alice, 3));
        assertFalse(pass.verifyHolder(bob, 1));
    }

    function test_VerifyHolder_TrueForZeroMin() public view {
        assertTrue(pass.verifyHolder(alice, 0));
        assertTrue(pass.verifyHolder(address(0), 0));
    }

    // ---------- withdraw ----------

    function test_Withdraw_HappyPath_OnForcedFunds() public {
        // Free balance only arises from ETH that ends up in the contract outside
        // of purchaseTicket (e.g. forced via SELFDESTRUCT). vm.deal simulates that.
        _buy(alice, 10);
        uint256 reserved = address(pass).balance;
        vm.deal(address(pass), reserved + 7 ether);

        vm.expectEmit(true, false, false, true);
        emit Withdrawn(venue, 7 ether);

        uint256 venueEthBefore = venue.balance;
        vm.prank(venue);
        pass.withdraw();

        assertEq(venue.balance, venueEthBefore + 7 ether);
        assertEq(address(pass).balance, reserved);
    }

    function test_Withdraw_RevertsOnNonVenueCaller() public {
        vm.prank(alice);
        vm.expectRevert("AAP: only venue");
        pass.withdraw();
    }

    function test_Withdraw_RevertsOnNoFreeBalance_FreshContract() public {
        vm.prank(venue);
        vm.expectRevert("AAP: no free balance");
        pass.withdraw();
    }

    function test_Withdraw_RevertsOnNoFreeBalance_AfterPurchase() public {
        _buy(alice, 5);
        vm.prank(venue);
        vm.expectRevert("AAP: no free balance");
        pass.withdraw();
    }

    // ---------- Reentrancy ----------

    function test_Reentrancy_ReturnTicket_GuardBlocksReentrantReturn() public {
        ReentrantAttacker attacker = new ReentrantAttacker();
        attacker.setPass(pass);
        attacker.buy{value: 5 * TICKET_PRICE}(5);

        attacker.setMode(ReentrantAttacker.Mode.ReenterReturn, 1, 0);

        attacker.callReturn(2);

        assertTrue(attacker.reenterAttempted(), "receive() should have been called");
        assertEq(
            bytes4(attacker.innerRevert()),
            ReentrancyGuard.ReentrancyGuardReentrantCall.selector,
            "inner revert should be the guard"
        );
        // Outer call still completed: 2 burned, 3 left, refund delivered.
        assertEq(pass.balanceOf(address(attacker)), 3);
        assertEq(pass.totalSupply(), 3);
        assertEq(address(attacker).balance, 2 * TICKET_PRICE);
    }

    function test_Reentrancy_ReturnTicket_GuardBlocksReentrantPurchase() public {
        ReentrantAttacker attacker = new ReentrantAttacker();
        attacker.setPass(pass);
        attacker.buy{value: 5 * TICKET_PRICE}(5);

        attacker.setMode(ReentrantAttacker.Mode.ReenterPurchase, 1, TICKET_PRICE);

        attacker.callReturn(2);

        assertTrue(attacker.reenterAttempted());
        assertEq(
            bytes4(attacker.innerRevert()),
            ReentrancyGuard.ReentrancyGuardReentrantCall.selector,
            "inner revert should be the guard"
        );
        assertEq(pass.balanceOf(address(attacker)), 3);
        assertEq(pass.totalSupply(), 3);
    }

    function test_Reentrancy_Withdraw_GuardBlocksReentrantWithdraw() public {
        // Make the attacker the venue: deploy attacker first, then deploy a fresh
        // AgentAccessPass with the attacker pranked as msg.sender.
        ReentrantAttacker attacker = new ReentrantAttacker();
        vm.prank(address(attacker));
        AgentAccessPass evilPass = new AgentAccessPass(TICKET_PRICE, MAX_SUPPLY);
        attacker.setPass(evilPass);

        // Force funds into the contract so there is something to withdraw.
        vm.deal(address(evilPass), 3 ether);

        attacker.setMode(ReentrantAttacker.Mode.ReenterWithdraw, 0, 0);

        attacker.callWithdraw();

        assertTrue(attacker.reenterAttempted());
        assertEq(
            bytes4(attacker.innerRevert()),
            ReentrancyGuard.ReentrancyGuardReentrantCall.selector,
            "inner revert should be the guard"
        );
        // The outer withdraw still completed: attacker received the free funds.
        assertEq(address(attacker).balance, 3 ether);
        assertEq(address(evilPass).balance, 0);
    }

    // ---------- ERC-20 standard behavior (lightweight sanity) ----------

    function test_ERC20_TransferBetweenWallets() public {
        _buy(alice, 5);
        vm.prank(alice);
        assertTrue(pass.transfer(bob, 2));
        assertEq(pass.balanceOf(alice), 3);
        assertEq(pass.balanceOf(bob), 2);
        assertTrue(pass.verifyHolder(bob, 2));
        assertFalse(pass.verifyHolder(bob, 3));
    }

    function test_ERC20_ApproveAndTransferFrom() public {
        _buy(alice, 5);
        vm.prank(alice);
        assertTrue(pass.approve(bob, 3));
        vm.prank(bob);
        assertTrue(pass.transferFrom(alice, bob, 3));
        assertEq(pass.balanceOf(alice), 2);
        assertEq(pass.balanceOf(bob), 3);
    }
}
