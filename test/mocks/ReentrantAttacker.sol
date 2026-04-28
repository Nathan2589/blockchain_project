// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {AgentAccessPass} from "../../src/AgentAccessPass.sol";

contract ReentrantAttacker {
    enum Mode {
        None,
        ReenterReturn,
        ReenterPurchase,
        ReenterWithdraw
    }

    AgentAccessPass public pass;
    Mode public mode;
    uint256 public reenterQuantity;
    uint256 public reenterValue;
    bytes public innerRevert;
    bool public reenterAttempted;

    function setPass(AgentAccessPass _pass) external {
        pass = _pass;
    }

    function setMode(Mode _mode, uint256 _quantity, uint256 _value) external {
        mode = _mode;
        reenterQuantity = _quantity;
        reenterValue = _value;
        delete innerRevert;
        reenterAttempted = false;
    }

    function buy(uint256 quantity) external payable {
        pass.purchaseTicket{value: msg.value}(quantity);
    }

    function callReturn(uint256 quantity) external {
        pass.returnTicket(quantity);
    }

    function callWithdraw() external {
        pass.withdraw();
    }

    receive() external payable {
        if (mode == Mode.None) {
            return;
        }
        reenterAttempted = true;
        if (mode == Mode.ReenterReturn) {
            try pass.returnTicket(reenterQuantity) {}
            catch (bytes memory reason) {
                innerRevert = reason;
            }
        } else if (mode == Mode.ReenterPurchase) {
            try pass.purchaseTicket{value: reenterValue}(reenterQuantity) {}
            catch (bytes memory reason) {
                innerRevert = reason;
            }
        } else if (mode == Mode.ReenterWithdraw) {
            try pass.withdraw() {}
            catch (bytes memory reason) {
                innerRevert = reason;
            }
        }
    }
}
