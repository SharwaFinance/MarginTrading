// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IOperationalTreasury} from "../interfaces/modularSwapRouter/hegic/IOperationalTreasury.sol";
import {IHegicStrategy} from "../interfaces/modularSwapRouter/hegic/IHegicStrategy.sol";
import {IProxySeller} from "../interfaces/txBuilder/IProxySeller.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ProxySeller is IProxySeller {
    IOperationalTreasury public operation;

    function buyWithReferal(
        IHegicStrategy strategy,
        uint256 amount,
        uint256 period,
        bytes[] calldata additional,
        address referrer
    )  external {
        operation.buy(
            strategy,
            msg.sender,
            amount, 
            period,
            additional
        );  
    }
}
