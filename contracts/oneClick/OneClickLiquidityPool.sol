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

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IWETH9} from "./IWETH9.sol";
import {ILiquidityPool} from "../interfaces/ILiquidityPool.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract OneClickLiquidityPool is AccessControl{
    ILiquidityPool public wethLiquidityPool;
    address public weth;

    constructor(
        ILiquidityPool _wethLiquidityPool,
        address _weth
    ) {
        wethLiquidityPool = _wethLiquidityPool;      
        weth = _weth;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    receive() external payable {}

    function approveERC20(address token, address to, uint amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).approve(to, amount);
    }

    function provideETHToPool() external payable {
        IWETH9(weth).deposit{value: msg.value}();
        wethLiquidityPool.provide(msg.value);
        wethLiquidityPool.transfer(msg.sender, wethLiquidityPool.balanceOf(address(this)));
        emit ProvideETH(msg.sender, msg.value);
    }

    function withdrawETHFromPool(uint amount) external payable {
        wethLiquidityPool.transferFrom(msg.sender, address(this), amount);
        wethLiquidityPool.withdraw(amount);
        uint weth_amount = IERC20(weth).balanceOf(address(this));
        IWETH9(weth).withdraw(weth_amount);
        (bool success, ) = payable(msg.sender).call{value: weth_amount}("");
        require(success, "ETH transfer failed");
        emit WithdrawETH(msg.sender, weth_amount);
    }

    event ProvideETH(
        address indexed liquidityProvider,
        uint amountDepositPoolTokens
    );

    event WithdrawETH(
        address indexed liquidityProvider,
        uint amountWithdrawPoolTokens
    );
}