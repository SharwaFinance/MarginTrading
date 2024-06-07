// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IHegicStrategy} from "../interfaces/modularSwapRouter/hegic/IHegicStrategy.sol";
import { IOperationalTreasury } from "../interfaces/modularSwapRouter/hegic/IOperationalTreasury.sol";

contract MockOperationalTreasury is IOperationalTreasury {
    struct LockedLiquidity {
        LockedLiquidityState state;
        uint128 negativepnl;
        uint128 positivepnl;
        uint32 expiration;
    }

    IHegicStrategy public theOnlyStrategy;

    mapping(uint256 => LockedLiquidity) public lockedLiquidityData;

    constructor(
        IHegicStrategy _theOnlyStrategy
    ) {
        theOnlyStrategy = _theOnlyStrategy;
    }

    function payOff(uint256 positionID, address account) external override {}

    function lockedLiquidity(uint256 id)
        external
        override
        view
        returns (
            LockedLiquidityState state,
            IHegicStrategy strategy,
            uint128 negativepnl,
            uint128 positivepnl,
            uint32 expiration
        )
    {
        LockedLiquidity memory locLiquidity = lockedLiquidityData[id];
        state = locLiquidity.state;
        strategy = theOnlyStrategy;
        negativepnl = locLiquidity.negativepnl;
        positivepnl = locLiquidity.positivepnl;
        expiration = locLiquidity.expiration;
    }

    function setLockedLiquidity(
        uint256 id,
        uint256 period,
        LockedLiquidityState state
    ) external {
        lockedLiquidityData[id].expiration = uint32(block.timestamp + period);
        lockedLiquidityData[id].state = state;
    }

    function buy(
        IHegicStrategy strategy,
        address holder,
        uint256 amount,
        uint256 period,
        bytes[] calldata additional
    ) external {}
}
