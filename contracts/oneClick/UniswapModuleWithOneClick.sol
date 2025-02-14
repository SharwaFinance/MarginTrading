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

import {UniswapModuleBase, ISwapRouter, IQuoter, ERC20} from "../modularSwapRouter/uniswap/UniswapModuleBase.sol";

contract UniswapModuleWithOneClick is UniswapModuleBase {
    constructor(
        address _marginAccount,
        address _tokenInContract,
        uint24 _poolFee,
        address _tokenOutContract,
        ISwapRouter _swapRouter,
        IQuoter _quoter
    ) UniswapModuleBase(
        _marginAccount,
        _tokenInContract,
        _poolFee,
        _tokenOutContract,
        _swapRouter,
        _quoter    
    ) {}

    // ONLY MANAGER_ROLE FUNTIONS //

    function setMarginAccount(address newMarginAccount) external onlyRole(MANAGER_ROLE) {
        marginAccount = newMarginAccount;
    }

}
