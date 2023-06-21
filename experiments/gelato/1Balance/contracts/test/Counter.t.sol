// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/CounterERC2771.sol";

contract CounterTest is Test {
    CounterERC2771 public counter;

    function setUp() public {
        address trustedForwarderGelato = 0xd8253782c45a12053594b9deB72d8e8aB2Fca54c;
        counter = new CounterERC2771(trustedForwarderGelato);
    }


}
