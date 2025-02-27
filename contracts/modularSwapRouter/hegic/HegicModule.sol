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

import {IPositionManagerERC721} from "../../interfaces/modularSwapRouter/IPositionManagerERC721.sol";
import {IPositionManagerERC20} from "../../interfaces/modularSwapRouter/IPositionManagerERC20.sol"; 
import {IHegicStrategy} from "../../interfaces/modularSwapRouter/hegic/IHegicStrategy.sol";
import {IOperationalTreasury} from "../../interfaces/modularSwapRouter/hegic/IOperationalTreasury.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title HegicModule
 * @dev A module for managing and liquidating Hegic options using ERC721 and ERC20 tokens.
 * @notice This contract facilitates the liquidation of Hegic options and the management of associated tokens.
 * @author 0nika0
 */
contract HegicModule is IPositionManagerERC721, AccessControl {
    bytes32 public constant MODULAR_SWAP_ROUTER_ROLE = keccak256("MODULAR_SWAP_ROUTER_ROLE");

    IERC20 public hegicReturnToken;
    IERC721 public hegicPositionManager;
    IOperationalTreasury public operationalTreasury;
    IPositionManagerERC20 public assetExchangerUSDCetoUSDC;

    address public marginAccount;

    constructor(
        IERC20 _hegicReturnToken,
        IERC721 _hegicPositionManager,
        IOperationalTreasury _operationalTreasury,
        IPositionManagerERC20 _assetExchangerUSDCetoUSDC,
        address _marginAccount
    ) {
        hegicReturnToken = _hegicReturnToken;
        operationalTreasury = _operationalTreasury;
        assetExchangerUSDCetoUSDC = _assetExchangerUSDCetoUSDC;
        hegicPositionManager = _hegicPositionManager;
        marginAccount = _marginAccount;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ONLY MODULAR_SWAP_ROUTER_ROLE FUNCTIONS //

    function liquidate(uint marginAccountID, uint[] memory value, address holder) external onlyRole(MODULAR_SWAP_ROUTER_ROLE) returns(uint amountOut) {
        for (uint i; i < value.length; i++) {
            uint profit = getPayOffAmount(value[i]);
            if (profit > 0 && isOptionActive(value[i]) && getExpirationTime(value[i]) > block.timestamp) {
                operationalTreasury.payOff(value[i], marginAccount);
                uint amountOutMinimum = assetExchangerUSDCetoUSDC.getInputPositionValue(profit);
                amountOut += assetExchangerUSDCetoUSDC.swapInput(profit, amountOutMinimum);
            } 
            hegicPositionManager.transferFrom(marginAccount, holder, value[i]);
            emit LiquidateERC721(marginAccountID, address(hegicPositionManager), assetExchangerUSDCetoUSDC.tokenOutContract(), value[i], amountOut);
        }
    }

    function exercise(uint id) external onlyRole(MODULAR_SWAP_ROUTER_ROLE) returns(uint amountOut) {
        uint profit = getPayOffAmount(id);
        require(profit > 0 && isOptionActive(id) && getExpirationTime(id) > block.timestamp, "The option is not active or there is no profit on it");
        hegicPositionManager.transferFrom(marginAccount, address(this), id);
        operationalTreasury.payOff(id, marginAccount);
        uint amountOutMinimum = assetExchangerUSDCetoUSDC.getInputPositionValue(profit);
        amountOut = assetExchangerUSDCetoUSDC.swapInput(profit, amountOutMinimum);
        hegicPositionManager.transferFrom(address(this), marginAccount, id);
    }

    // EXTERNAL FUNCTIONS //

    function checkValidityERC721(uint id) external returns(bool) {
        if (isOptionActive(id) && getExpirationTime(id) > block.timestamp) {
            return true;
        }
    }

    function onERC721Received(
        address, 
        address, 
        uint256, 
        bytes calldata
    ) external returns(bytes4) {
        return bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));
    } 

    // PUBLIC FUNCTIONS //

    function getOptionValue(uint id) public returns (uint positionValue) {
        if (isOptionActive(id) && getExpirationTime(id) > block.timestamp) {
            uint profit = getPayOffAmount(id);
            if (profit == 0) {
                positionValue = 0;    
            } else {
                positionValue = assetExchangerUSDCetoUSDC.getInputPositionValue(profit);
            }
        }
    }

    function getPositionValue(uint[] memory value) public returns (uint positionValue) {
        for (uint i; i < value.length; i++) {
            positionValue += getOptionValue(value[i]);
        }
    }

    function getExpirationTime(uint256 tokenId) public view returns (uint256) {
        (, , , , uint32 expiration) = operationalTreasury.lockedLiquidity(tokenId);
        return uint256(expiration);
    }

    function isOptionActive(uint id) public view returns(bool) {
        (IOperationalTreasury.LockedLiquidityState state, , , , ) = operationalTreasury.lockedLiquidity(id);
        return state == IOperationalTreasury.LockedLiquidityState.Locked;
    }

    function getStrategy(uint id) public view returns(address) {
        (, IHegicStrategy strategy, , , ) = operationalTreasury.lockedLiquidity(id);
        return address(strategy);
    }

    // PRIVATE FUNCTIONS //

    /**
     * @notice Gets the payoff amount for a given token ID.
     * @param tokenID The ID of the token.
     * @return The payoff amount.
     */
    function getPayOffAmount(uint tokenID) private view returns (uint) {
        (, IHegicStrategy strategy, , , ) = operationalTreasury.lockedLiquidity(tokenID);
        return strategy.payOffAmount(tokenID);
    } 
}
