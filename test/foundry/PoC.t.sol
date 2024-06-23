// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./Base.sol";

contract PoC is Base {
    function setUp() public {
        setup();
        setupActors();
    }

    function test_foo() public {
        assert(true);
    }
}
