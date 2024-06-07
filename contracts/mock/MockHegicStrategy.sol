// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IHegicStrategy} from "../interfaces/modularSwapRouter/hegic/IHegicStrategy.sol";

contract MockHegicStrategy is IHegicStrategy {
    mapping(uint256 => uint256) private payOffAmounts;

    function setPayOffAmount(uint256 optionID, uint256 amount) external {
        payOffAmounts[optionID] = amount;
    }

    function payOffAmount(uint256 optionID) external view override returns (uint256) {
        return payOffAmounts[optionID];
    }

    function calculateNegativepnlAndPositivepnl(
        uint256 amount,
        uint256 period,
        bytes[] calldata
    ) external view returns (uint128 negativepnl, uint128 positivepnl) {}
}