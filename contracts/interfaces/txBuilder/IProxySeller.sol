pragma solidity 0.8.20;

import {IHegicStrategy} from "../modularSwapRouter/hegic/IHegicStrategy.sol";

interface IProxySeller {
    function buyWithReferal(
        IHegicStrategy strategy,
        uint256 amount,
        uint256 period,
        bytes[] calldata additional,
        address referrer
    )  external;
}
