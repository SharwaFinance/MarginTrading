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

import {IMarginAccount} from "./interfaces/IMarginAccount.sol";
import {IMarginTrading} from "./interfaces/IMarginTrading.sol";
import {ILiquidityPool} from "./interfaces/ILiquidityPool.sol";
import {IStopMarketOrder} from "./interfaces/IStopMarketOrder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMarginAccountManager} from "./interfaces/IMarginAccountManager.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract StopMarketOrder is AccessControl, IStopMarketOrder {
    enum StatusOrder {
        ACTIVE,
        EXECUTED,
        DELETED
    }

    struct Order {
        uint marginAccountID;
        address addressTokenIn;
        uint amountTokenIn;
        address addressTokenOut;
        uint amountTokenOutMinimum;
        int256 targetPrice;
        uint8 typeConditions;
        uint8 autoRepay;
        StatusOrder statusOrder;
    }

    Order[] public allOrders;
    uint[]  public activeIdOrders;

    mapping(uint => uint) public marginAccountIDToAmountOrder;
    mapping(uint => uint[]) public userOrders;
    mapping(address => address) public availableTokenToChainLinkData;

    uint public maximumActiveOrders;
    uint public maximumMarginAccountOrders;

    IMarginAccount public immutable marginAccount;
    IMarginTrading public immutable marginTrading;
    IMarginAccountManager public immutable marginAccountManager;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    constructor(
        address _marginAccount,
        address _marginTrading,
        address _marginAccountManager
    ) {
        maximumActiveOrders = 2000;
        maximumMarginAccountOrders = 10;
        marginAccount = IMarginAccount(_marginAccount);
        marginTrading = IMarginTrading(_marginTrading);
        marginAccountManager = IMarginAccountManager(_marginAccountManager);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setAvailableTokenToChainLinkData(address availableToken, address chainLinkData) external onlyRole(MANAGER_ROLE) {
        availableTokenToChainLinkData[availableToken] = chainLinkData;
    }

    function setMaximumActiveOrders(uint newMaximumActiveOrders) external onlyRole(MANAGER_ROLE) {
        maximumActiveOrders = newMaximumActiveOrders;
    }

    function setMaximumMarginAccountOrders(uint newMaximumMarginAccountOrders) external onlyRole(MANAGER_ROLE) {
        maximumMarginAccountOrders = newMaximumMarginAccountOrders;
    }

    function getAllOrdersLength() external view returns (uint) {
        return allOrders.length;
    }

    function getActiveIdOrdersLength() external view returns (uint) {
        return activeIdOrders.length;
    }

    function getUserOrdersLength(uint marginAccountID) external view returns (uint) {
        return userOrders[marginAccountID].length;
    }

    function addOrder(uint marginAccountID, address addressTokenIn, uint amountTokenIn, address addressTokenOut, uint amountTokenOutMinimum, int256 targetPrice, uint8 typeConditions, uint8 useBorrow, uint8 autoRepay) external {
        _onlyApprovedOrOwner(marginAccountID);
        address chainLinkData = getAvailableChainLinkData(addressTokenIn, addressTokenOut);
        require(
            chainLinkData != address(0),
            "Oracle has no information about the token!"
        );
        require(
            marginAccountIDToAmountOrder[marginAccountID] < maximumMarginAccountOrders,
            "The limit of available orders for the marginAccountID user has been reached!"
        );
        require(
            activeIdOrders.length < maximumActiveOrders,
            "The limit of available active orders has been reached!"
        );
        require(
            typeConditions == 0 || typeConditions == 1,
            "Undefined type of execution condition!"
        );
        require(
            addressTokenIn != addressTokenOut,
            "The addresses for the token exchange must not match!"
        );
        require(
            amountTokenIn > 0,
            "The number of tokens to be exchanged cannot be equal to 0!"
        );
        require(
            targetPrice > 0,
            "An order cannot be added with a target price equal to 0!"
        );

        uint userBalance = marginAccount.getErc20ByContract(marginAccountID, addressTokenIn);
        if (useBorrow != 0 && userBalance < amountTokenIn) {
            marginTrading.borrow(marginAccountID, addressTokenIn, amountTokenIn - userBalance);
        }

        Order memory newOrder = Order({
            marginAccountID: marginAccountID,
            addressTokenIn: addressTokenIn,
            amountTokenIn: amountTokenIn,
            addressTokenOut: addressTokenOut,
            amountTokenOutMinimum: amountTokenOutMinimum,
            targetPrice: targetPrice,
            typeConditions: typeConditions,
            autoRepay: autoRepay,
            statusOrder: StatusOrder.ACTIVE
        });

        marginAccountIDToAmountOrder[marginAccountID] += 1;
        activeIdOrders.push(allOrders.length);
        userOrders[marginAccountID].push(allOrders.length);
        allOrders.push(newOrder);

        emit AddNewOrder(
            marginAccountID,
            addressTokenIn,
            amountTokenIn,
            addressTokenOut,
            amountTokenOutMinimum,
            targetPrice,
            typeConditions,
            autoRepay
        );
    }

    function editOrder(uint idOrder, uint amountTokenIn, uint amountTokenOutMinimum, int256 targetPrice, uint8 useBorrow, uint8 autoRepay) external {
        Order memory thisOrder = allOrders[idOrder];
        _onlyApprovedOrOwner(thisOrder.marginAccountID);
        require(thisOrder.statusOrder == StatusOrder.ACTIVE, "The order inactive");
        require(
            amountTokenIn > 0,
            "The number of tokens to be exchanged cannot be equal to 0!"
        );
        require(
            targetPrice > 0,
            "The targetPrice cannot be equal to 0!"
        );

        uint userBalance = marginAccount.getErc20ByContract(thisOrder.marginAccountID, thisOrder.addressTokenIn);
        if (useBorrow != 0 && userBalance < amountTokenIn) {
            marginTrading.borrow(thisOrder.marginAccountID, thisOrder.addressTokenIn, amountTokenIn - userBalance);
        }

        thisOrder.amountTokenIn = amountTokenIn;
        thisOrder.amountTokenOutMinimum = amountTokenOutMinimum;
        thisOrder.targetPrice = targetPrice;
        thisOrder.autoRepay = autoRepay;
        allOrders[idOrder] = thisOrder;

        emit EditActiveOrder(
            thisOrder.marginAccountID,
            thisOrder.addressTokenIn,
            amountTokenIn,
            thisOrder.addressTokenOut,
            amountTokenOutMinimum,
            targetPrice,
            thisOrder.typeConditions,
            autoRepay
        );
    }

    function executeOrder(uint activeOrderId) external {
        require(
            orderReachedTargetPrice(activeIdOrders[activeOrderId]),
            "The order execution condition has not been reached!"
        );
        Order memory thisOrder = allOrders[activeIdOrders[activeOrderId]];
        uint userBalanceTokenOutBefore = marginAccount.getErc20ByContract(thisOrder.marginAccountID, thisOrder.addressTokenOut);
        uint userBalance = marginAccount.getErc20ByContract(thisOrder.marginAccountID, thisOrder.addressTokenIn);
        if (userBalance < thisOrder.amountTokenIn) {
            marginTrading.borrow(
                thisOrder.marginAccountID,
                thisOrder.addressTokenIn, 
                thisOrder.amountTokenIn - userBalance
            );
        }
        marginTrading.swap(
            thisOrder.marginAccountID,
            thisOrder.addressTokenIn, 
            thisOrder.addressTokenOut,
            thisOrder.amountTokenIn,
            thisOrder.amountTokenOutMinimum
        );
        if (userBalance >= thisOrder.amountTokenIn && thisOrder.autoRepay != 0) {
            uint userBalanceRepay = marginAccount.getErc20ByContract(thisOrder.marginAccountID, thisOrder.addressTokenOut) - userBalanceTokenOutBefore;
            if (availableRepay(thisOrder.marginAccountID, thisOrder.addressTokenOut, userBalanceRepay) == 1) {
                marginTrading.repay(
                    thisOrder.marginAccountID,
                    thisOrder.addressTokenOut,
                    userBalanceRepay
                );
            }
        }
        allOrders[activeIdOrders[activeOrderId]].statusOrder = StatusOrder.EXECUTED;
        _deleteOrder(activeOrderId);

        emit ExecutActiveOrder(
            thisOrder.marginAccountID,
            thisOrder.addressTokenIn,
            thisOrder.amountTokenIn,
            thisOrder.addressTokenOut,
            thisOrder.amountTokenOutMinimum,
            thisOrder.targetPrice,
            thisOrder.typeConditions,
            thisOrder.autoRepay
        );
    }

    function deleteOrder(uint activeOrderId) external {
        Order memory thisOrder = allOrders[activeIdOrders[activeOrderId]];
        _onlyApprovedOrOwner(thisOrder.marginAccountID);
        require(thisOrder.statusOrder == StatusOrder.ACTIVE, "The order inactive");
        thisOrder.statusOrder = StatusOrder.DELETED;
        _deleteOrder(activeOrderId);

        emit DeleteActiveOrder(
            thisOrder.marginAccountID,
            thisOrder.addressTokenIn,
            thisOrder.amountTokenIn,
            thisOrder.addressTokenOut,
            thisOrder.amountTokenOutMinimum,
            thisOrder.targetPrice,
            thisOrder.typeConditions,
            thisOrder.autoRepay
        );
    }

    function availableBorrow(uint marginAccountID, address addressTokenIn, uint amountTokenIn) public returns (uint) {
        if (!marginAccount.isAvailableErc20(addressTokenIn)) {
            return 440; // The token you are trying to deposit is not available for loan issuance
        }
        address liquidityPoolAddress = marginAccount.tokenToLiquidityPool(addressTokenIn); 
        if (liquidityPoolAddress == address(0)) {
            return 441; // There is no liquidity pool for the specified token
        }
        if (amountTokenIn == 0) {
            return 442; // The loan amount must be greater than 0
        }
        uint balanceLiquidityPool = IERC20(addressTokenIn).balanceOf(liquidityPoolAddress);
        if (balanceLiquidityPool < amountTokenIn) {
            return 443; // There are not enough tokens in the liquidity pool to provide a loan
        }
        ILiquidityPool contractLiquidityPool = ILiquidityPool(liquidityPoolAddress);
        uint totalBorrows = contractLiquidityPool.totalBorrows();
        if ((totalBorrows + balanceLiquidityPool) * contractLiquidityPool.maximumBorrowMultiplier() / 1e4 < (totalBorrows + amountTokenIn)) {
            return 444; // The limit of tokens for granting a loan has been reached in the liquidity pool
        }
        if (marginTrading.getMarginAccountRatio(marginAccountID) <= marginTrading.yellowCoeff()) {
            return 445; // It is impossible to borrow because the margin account ratio is too high
        }
        return 1; // OK
    }

    function availableRepay(uint marginAccountID, address addressTokenOut, uint amountTokenOut) public returns (uint) {
        address liquidityPoolAddress = marginAccount.tokenToLiquidityPool(addressTokenOut); 
        if (liquidityPoolAddress == address(0)) {
            return 540; // The token you are trying to deposit is not available for loan repayment
        }
        uint debtWithAccruedInterest = ILiquidityPool(liquidityPoolAddress).getDebtWithAccruedInterest(marginAccountID);
        if (amountTokenOut == 0 || amountTokenOut > debtWithAccruedInterest) {
            amountTokenOut = debtWithAccruedInterest;
        }
        if (amountTokenOut > marginAccount.getErc20ByContract(marginAccountID, addressTokenOut)) {
            return 541; // There are not enough tokens on the balance sheet to repay the debt
        }
        if (amountTokenOut == 0) {
            return 542; // There is no point in returning 0 tokens
        }
        return 1;
    }

    function availableOrderForExecution(uint idOrder) public returns (uint) {
        Order memory thisOrder = allOrders[idOrder];
        uint userBalance = marginAccount.getErc20ByContract(thisOrder.marginAccountID, thisOrder.addressTokenIn);
        if (userBalance < thisOrder.amountTokenIn) {
            uint codeBorrow = availableBorrow(thisOrder.marginAccountID, thisOrder.addressTokenIn, thisOrder.amountTokenIn);
            if (codeBorrow != 1) {
                return codeBorrow; // Order execution is not possible
            }
        }

        if (orderReachedTargetPrice(idOrder)) {
            return 1;
        }

        return 0; // Order execution is not possible
    }

    function orderReachedTargetPrice(uint idOrder) public returns (bool) {
        Order memory thisOrder = allOrders[idOrder];

        address chainLinkData = getAvailableChainLinkData(thisOrder.addressTokenIn, thisOrder.addressTokenOut);
        AggregatorV3Interface aggregatorChainLinkData = AggregatorV3Interface(chainLinkData);
        (,int256 answer,,,) = aggregatorChainLinkData.latestRoundData();

        if (thisOrder.typeConditions == 1) {
            if (answer >= thisOrder.targetPrice) {
                return true;
            }
        } else if (thisOrder.typeConditions == 0) {
            if (answer <= thisOrder.targetPrice) {
                return true;
            }
        }

        return false;
    }

    function getAvailableChainLinkData(address addressTokenIn, address addressTokenOut) public view returns (address chainLinkData) {
        chainLinkData = availableTokenToChainLinkData[addressTokenIn];
        if (chainLinkData == address(0)) {
            chainLinkData = availableTokenToChainLinkData[addressTokenOut];
        }
    }

    function _onlyApprovedOrOwner(uint marginAccountID) internal view {
        require(marginAccountManager.isApprovedOrOwner(msg.sender, marginAccountID), "You are not the owner of the token");
    }

    function _deleteOrder(uint activeOrderId) internal {
        marginAccountIDToAmountOrder[allOrders[activeIdOrders[activeOrderId]].marginAccountID] -= 1;
        activeIdOrders[activeOrderId] = activeIdOrders[activeIdOrders.length-1];
        activeIdOrders.pop(); 
    }

}
