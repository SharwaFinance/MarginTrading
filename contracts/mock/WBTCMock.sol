// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WBTCMock is ERC20 {
    constructor() ERC20("Mock WBTC", "WBTC") {
        _mint(msg.sender, 1000000000 * 10**6);
    }

    function decimals() public pure override returns (uint8) {
        return 8;
    }
}