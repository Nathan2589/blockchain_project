// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {AgentAccessPass} from "../src/AgentAccessPass.sol";

contract Deploy is Script {
    function run() external returns (AgentAccessPass pass) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 ticketPrice = vm.envUint("TICKET_PRICE_WEI");
        uint256 maxSupply = vm.envUint("MAX_SUPPLY");

        vm.startBroadcast(deployerKey);
        pass = new AgentAccessPass(ticketPrice, maxSupply);
        vm.stopBroadcast();

        console2.log("AgentAccessPass deployed at:", address(pass));
        console2.log("Venue (deployer):           ", vm.addr(deployerKey));
        console2.log("Ticket price (wei):         ", ticketPrice);
        console2.log("Max supply:                 ", maxSupply);
    }
}
