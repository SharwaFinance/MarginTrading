// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IOperationalTreasury} from "../interfaces/modularSwapRouter/hegic/IOperationalTreasury.sol";
import {IPositionsManager} from "../interfaces/oneClick/IPositionsManager.sol";
import {IHegicStrategy} from "../interfaces/modularSwapRouter/hegic/IHegicStrategy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockOperationalTreasury is IOperationalTreasury {
    struct LockedLiquidity {
        LockedLiquidityState state;
        uint128 negativepnl;
        uint128 positivepnl;
        uint32 expiration;
    }

    IHegicStrategy public theOnlyStrategy;
    IPositionsManager public positionsManager;
    ERC20 public usdcE;

    mapping(uint256 => LockedLiquidity) public lockedLiquidityData;

    constructor(
        IHegicStrategy _theOnlyStrategy,
        // IPositionsManager _positionsManager, 
        address _usdcE
    ) {
        theOnlyStrategy = _theOnlyStrategy;
        // positionsManager = _positionsManager; 
        usdcE = ERC20(_usdcE);
    }

    function payOff(uint256 positionID, address account) external override {
        LockedLiquidity storage ll = lockedLiquidityData[positionID];
        uint256 amount = theOnlyStrategy.payOffAmount(positionID);
        require(
            ll.expiration > block.timestamp,
            "The option has already expired"
        );
        require(
            ll.state == LockedLiquidityState.Locked,
            "The liquidity has already been unlocked"
        );
        usdcE.transfer(account, amount);
        ll.state = LockedLiquidityState.Unlocked;
    }

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
    ) external {
        uint256 optionID = positionsManager.createOptionFor(holder);
    }
}
