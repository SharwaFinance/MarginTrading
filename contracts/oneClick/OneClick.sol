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

import {IMarginTrading} from "../interfaces/IMarginTrading.sol";
import {IMarginAccount} from "../interfaces/IMarginAccount.sol";
import {IHegicStrategy} from "../interfaces/modularSwapRouter/hegic/IHegicStrategy.sol";
import {IPositionsManager} from "../interfaces/oneClick/IPositionsManager.sol";
import {IMarginAccountManager} from "../interfaces/IMarginAccountManager.sol";
import {IProxySeller} from "../interfaces/oneClick/IProxySeller.sol";
import {IPositionManagerERC20} from "../interfaces/modularSwapRouter/IPositionManagerERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IWETH9} from "./IWETH9.sol";
import {ILiquidityPool} from "../interfaces/ILiquidityPool.sol";

contract OneClickMarginTrading is AccessControl{

    IMarginAccountManager public marginAccountManager;
    IMarginTrading public marginTrading;
    IMarginAccount public marginAccount;
    IPositionsManager public hegicPositionManager;
    IProxySeller public proxySeller;
    ILiquidityPool public wethLiquidityPool;

    address public referrer;
    address public hegicTokenIn;
    address public weth;

    mapping(address => mapping(address => address)) public uniswapExchangeModules;

    constructor(
        IMarginAccountManager _marginAccountManager,
        IMarginTrading _marginTrading,
        IPositionsManager _hegicPositionManager,
        IProxySeller _proxySeller,
        IMarginAccount _marginAccount,
        ILiquidityPool _wethLiquidityPool,
        address _hegicTokenIn,
        address _referrer,
        address _weth
    ) {
        marginAccountManager = _marginAccountManager;
        marginTrading = _marginTrading;
        hegicPositionManager = _hegicPositionManager;
        proxySeller = _proxySeller;
        marginAccount = _marginAccount;  
        wethLiquidityPool = _wethLiquidityPool;      
        hegicTokenIn = _hegicTokenIn;
        referrer = _referrer;
        weth = _weth;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    modifier onlyApprovedOrOwner(uint marginAccountID) {
        require(marginAccountManager.isApprovedOrOwner(msg.sender, marginAccountID), "You are not the owner of the token");
        _;
    }

    // ONLY DEFAULT_ADMIN_ROLE FUNCTIONS

    function setUniswapExchangeModules(address tokenIn, address tokenOut, address module) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uniswapExchangeModules[tokenIn][tokenOut] = module; 
    }

    function approveERC20(address token, address to, uint amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).approve(to, amount);
    }

    function approveERC721ForAll(address token, address to, bool value) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC721(token).setApprovalForAll(to, value);
    }

    // ONLY marginAccountID APPROVE OR OWNER FUNCTIONS

    function provideETHToPool() external payable {
        IWETH9(weth).deposit{value: msg.value}();
        wethLiquidityPool.provide(msg.value);
        wethLiquidityPool.transfer(msg.sender, wethLiquidityPool.balanceOf(address(this)));
    }

    function provideETH(uint marginAccountID) external payable onlyApprovedOrOwner(marginAccountID) {
        IWETH9(weth).deposit{value: msg.value}();
        marginTrading.provideERC20(marginAccountID, weth, msg.value);
    }

    function borrowSwap(
        uint marginAccountID, 
        address tokenIn, 
        address tokenOut, 
        uint amountIn, 
        uint amountOutMinimum
    ) external onlyApprovedOrOwner(marginAccountID) {
        uint user_balance = marginAccount.getErc20ByContract(marginAccountID, tokenIn);
        if (user_balance < amountIn) {
            marginTrading.borrow(marginAccountID, tokenIn, amountIn - user_balance);
        }
        marginTrading.swap(marginAccountID, tokenIn, tokenOut, amountIn, amountOutMinimum);
    }

    function swapRepay(
        uint marginAccountID, 
        address tokenIn, 
        address tokenOut, 
        uint amountIn, 
        uint amountOutMinimum
    ) external onlyApprovedOrOwner(marginAccountID) {
        marginTrading.swap(marginAccountID, tokenIn, tokenOut, amountIn, amountOutMinimum);
        marginTrading.repay(marginAccountID, tokenOut, marginAccount.getErc20ByContract(marginAccountID, tokenOut));
    }

    function swapSwapRepay(
        uint marginAccountID, 
        address tokenOut, 
        address tokenIn_1, 
        uint amountIn_1, 
        uint amountOutMinimum_1,
        address tokenIn_2, 
        uint amountIn_2, 
        uint amountOutMinimum_2
    ) external onlyApprovedOrOwner(marginAccountID) {
        marginTrading.swap(marginAccountID, tokenIn_1, tokenOut, amountIn_1, amountOutMinimum_1);
        marginTrading.swap(marginAccountID, tokenIn_2, tokenOut, amountIn_2, amountOutMinimum_2);
        marginTrading.repay(marginAccountID, tokenOut, marginAccount.getErc20ByContract(marginAccountID, tokenOut));
    }

    function withdrawBuyProvideERC721(
        uint marginAccountID, 
        address tokenOut,
        IHegicStrategy strategy, 
        uint amount, 
        uint maxTotalCost, 
        uint period, 
        bytes[] memory additional
    ) external onlyApprovedOrOwner(marginAccountID) {
        (, uint128 positivepnl) = strategy.calculateNegativepnlAndPositivepnl(amount, period, additional);
        uint premium = uint256(positivepnl); 
        uint amountOut = IPositionManagerERC20(uniswapExchangeModules[hegicTokenIn][tokenOut]).getOutputPositionValue(premium);
        marginTrading.withdrawERC20(marginAccountID, tokenOut, amountOut);
        IPositionManagerERC20(uniswapExchangeModules[tokenOut][hegicTokenIn]).swapOutput(premium);
        require(premium <= maxTotalCost, "maximum total value exceeded");
        uint id = hegicPositionManager.nextTokenId();

        proxySeller.buyWithReferal(
            strategy,
            amount,
            period,
            additional,
            referrer
        );
        
        marginTrading.provideERC721(marginAccountID, address(hegicPositionManager), id);
    }

    function transferBuyProvideERC721(
        uint marginAccountID, 
        address tokenOut,
        IHegicStrategy strategy, 
        uint amount, 
        uint maxTotalCost, 
        uint period, 
        bytes[] memory additional
    ) external payable onlyApprovedOrOwner(marginAccountID) {
        (, uint128 positivepnl) = strategy.calculateNegativepnlAndPositivepnl(amount, period, additional);
        uint premium = uint256(positivepnl); 
        require(premium <= maxTotalCost, "maximum total value exceeded");
        if (tokenOut == hegicTokenIn) {
            IERC20(tokenOut).transferFrom(msg.sender, address(this), premium);    
        } else {
            uint amountOut = IPositionManagerERC20(uniswapExchangeModules[hegicTokenIn][tokenOut]).getOutputPositionValue(premium);
            if (msg.value != 0 && tokenOut == address(weth)) {
                IWETH9(weth).deposit{value: msg.value}();
                if (msg.value > amountOut) {
                    IERC20(tokenOut).transfer(msg.sender, msg.value-amountOut);
                }
            } else {
                IERC20(tokenOut).transferFrom(msg.sender, address(this), amountOut);
            }
            IPositionManagerERC20(uniswapExchangeModules[hegicTokenIn][tokenOut]).swapOutput(premium);
        }
        uint id = hegicPositionManager.nextTokenId();

        proxySeller.buyWithReferal(
            strategy,
            amount,
            period,
            additional,
            referrer
        );
        
        marginTrading.provideERC721(marginAccountID, address(hegicPositionManager), id);
    }

    function onERC721Received(
        address, 
        address, 
        uint256, 
        bytes calldata
    ) external returns(bytes4) {
        return bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));
    } 
}