// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import {
    ERC2771Context
} from "relay-context-contracts/vendor/ERC2771Context.sol";

contract CounterERC2771 is ERC2771Context {
    mapping(address => uint256) public contextCounter;
    event IncrementContextCounter(address _msgSender);
    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {}

    function increment() external  {
        // Remember that with the context shift of relaying,
        // where we would use `msg.sender` before, 
        // this now refers to Gelato Relay's address, 
        // and to find the address of the user, 
        // which has been verified using a signature,
        // please use _msgSender()!

        // If this contract was not not called by the 
        // trusted forwarder, _msgSender() will simply return 
        // the value of msg.sender instead.
        
        // Incrementing the counter mapped to the _msgSender!
        contextCounter[_msgSender()]++;
        
        // Emitting an event for testing purposes
        emit IncrementContextCounter(_msgSender());
    }
}
