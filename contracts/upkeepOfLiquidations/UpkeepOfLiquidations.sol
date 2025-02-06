pragma solidity 0.8.20;

/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * SharwaFinance
 * Copyright (C) 2025 SharwaFinance
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 **/

import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IMarginTrading} from "../interfaces/IMarginTrading.sol";

contract UpkeepOfLiquidations is 
    AutomationCompatibleInterface, 
    Ownable
{
    IMarginTrading public marginTrading;

    constructor(
        IMarginTrading _marginTrading
    ) {
        marginTrading = _marginTrading;
    }

    // OWNER FUNCTIONS //

    function setPortfolioLendingContract(IMarginTrading newPortfolioLendingContract) external onlyOwner {
        marginTrading = newPortfolioLendingContract;
    }

    // EXTERNAL FUNCTIONS // 

    function checkUpkeep(
        bytes calldata checkData
    )
        external
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        (uint256 lowerBound, uint256 upperBound) = abi.decode(
            checkData,
            (uint256, uint256)
        );

        for (uint256 i = lowerBound; i <= upperBound; i++) {
            if (marginTrading.getMarginAccountRatio(i) <= marginTrading.redCoeff()) {
                upkeepNeeded = true;
                performData = abi.encode(i);
                break;
            }
        }
        return (upkeepNeeded, performData);
    }

    function performUpkeep(bytes calldata performData) external override {
        (uint256 optionID) = abi.decode(
            performData,
            (uint256)
        );
        marginTrading.liquidate(optionID);
    }
}
