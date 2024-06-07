pragma solidity 0.8.20;

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

    IERC20 public hegicReturnToken;
    IOperationalTreasury public operationalTreasury;
    IPositionManagerERC20 public assetExchangerUSDCetoUSDC;
    IERC721 public hegicPositionManager;

    address public portfolioLending;

    bytes32 public constant MODULAR_SWAP_ROUTER_ROLE = keccak256("MODULAR_SWAP_ROUTER_ROLE");

    constructor(
        IERC20 _hegicReturnToken,
        IOperationalTreasury _operationalTreasury,
        IPositionManagerERC20 _assetExchangerUSDCetoUSDC,
        IERC721 _hegicPositionManager
    ) {
        hegicReturnToken = _hegicReturnToken;
        operationalTreasury = _operationalTreasury;
        assetExchangerUSDCetoUSDC = _assetExchangerUSDCetoUSDC;
        hegicPositionManager = _hegicPositionManager;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ONLY MODULAR_SWAP_ROUTER_ROLE FUNCTIONS //

    function liquidate(uint[] memory value) external onlyRole(MODULAR_SWAP_ROUTER_ROLE) returns(uint amountOut) {
        for (uint i; i < value.length; i++) {
            uint profit = getOptionValue(value[i]);
            hegicPositionManager.transferFrom(portfolioLending, address(this), value[i]);
            operationalTreasury.payOff(value[i], address(this));
            hegicReturnToken.approve(address(assetExchangerUSDCetoUSDC), profit);
            amountOut += assetExchangerUSDCetoUSDC.swapInput(profit, 0);
        }
    }

    // EXTERNAL FUNCTIONS //

    function checkValidityERC721(uint id) external returns(bool) {
        (IOperationalTreasury.LockedLiquidityState state, , , , ) = operationalTreasury.lockedLiquidity(id);
        return state == IOperationalTreasury.LockedLiquidityState.Locked;
    }

    // PUBLIC FUNCTIONS //

    function getOptionValue(uint id) public returns (uint positionValue) {
        uint profit = getPayOffAmount(id);
        positionValue += assetExchangerUSDCetoUSDC.getInputPositionValue(profit);
    }

    function getPositionValue(uint[] memory value) public returns (uint positionValue) {
        for (uint i; i < value.length; i++) {
            positionValue += getOptionValue(value[i]);
        }
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
