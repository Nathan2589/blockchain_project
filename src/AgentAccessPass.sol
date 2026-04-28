// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AgentAccessPass is ERC20, ReentrancyGuard {
    uint256 public immutable ticketPrice;
    address public immutable venue;
    uint256 public immutable maxSupply;

    event TicketPurchased(address indexed buyer, uint256 quantity, uint256 amountPaid);
    event TicketReturned(address indexed holder, uint256 quantity, uint256 amountRefunded);
    event Withdrawn(address indexed venue, uint256 amount);

    constructor(uint256 _ticketPrice, uint256 _maxSupply) ERC20("Agent Access Pass", "AAP") {
        ticketPrice = _ticketPrice;
        maxSupply = _maxSupply;
        venue = msg.sender;
    }

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    function purchaseTicket(uint256 quantity) external payable nonReentrant {
        require(quantity > 0, "AAP: quantity zero");
        require(totalSupply() + quantity <= maxSupply, "AAP: exceeds max supply");
        require(msg.value == quantity * ticketPrice, "AAP: incorrect payment");

        _mint(msg.sender, quantity);

        emit TicketPurchased(msg.sender, quantity, msg.value);
    }

    function returnTicket(uint256 quantity) external nonReentrant {
        require(quantity > 0, "AAP: quantity zero");
        require(balanceOf(msg.sender) >= quantity, "AAP: insufficient balance");

        _burn(msg.sender, quantity);

        uint256 refund = quantity * ticketPrice;
        emit TicketReturned(msg.sender, quantity, refund);

        (bool ok,) = msg.sender.call{value: refund}("");
        require(ok, "AAP: refund failed");
    }

    function verifyHolder(address wallet, uint256 minQuantity) external view returns (bool) {
        return balanceOf(wallet) >= minQuantity;
    }

    function withdraw() external nonReentrant {
        require(msg.sender == venue, "AAP: only venue");

        uint256 reserved = totalSupply() * ticketPrice;
        uint256 free = address(this).balance - reserved;
        require(free > 0, "AAP: no free balance");

        emit Withdrawn(venue, free);

        (bool ok,) = venue.call{value: free}("");
        require(ok, "AAP: withdraw failed");
    }
}
