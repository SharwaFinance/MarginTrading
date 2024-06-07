pragma solidity 0.8.20;

import {IHegicStrategy} from "./IHegicStrategy.sol";

interface IOperationalTreasury {
    enum LockedLiquidityState { Unlocked, Locked }

    /**
     * @param positionID The position ID to pay off.
     * @param account The address to receive the pay off.
     */
    function payOff(uint256 positionID, address account) external;

    /**
     * @param id The locked liquidity ID.
     * @return state The state of the locked liquidity.
     * @return strategy The strategy associated with the locked liquidity.
     * @return negativepnl The negative profit and loss value.
     * @return positivepnl The positive profit and loss value.
     * @return expiration The expiration time of the locked liquidity.
     */
    function lockedLiquidity(uint256 id)
        external
        view
        returns (
            LockedLiquidityState state,
            IHegicStrategy strategy,
            uint128 negativepnl,
            uint128 positivepnl,
            uint32 expiration
        );

    function buy(
        IHegicStrategy strategy,
        address holder,
        uint256 amount,
        uint256 period,
        bytes[] calldata additional
    ) external;
}