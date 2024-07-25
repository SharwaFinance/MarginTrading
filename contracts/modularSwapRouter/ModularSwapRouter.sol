pragma solidity 0.8.20;

import {IPositionManagerERC721} from "../interfaces/modularSwapRouter/IPositionManagerERC721.sol";
import {IPositionManagerERC20} from "../interfaces/modularSwapRouter/IPositionManagerERC20.sol"; 
import {IModularSwapRouter} from "../interfaces/modularSwapRouter/IModularSwapRouter.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IMarginTrading} from "../interfaces/IMarginTrading.sol";

/**
 * @title ModularSwapRouter
 * @dev A router contract for modular token swaps and liquidations.
 * @notice This contract facilitates token swaps and liquidations across different modules.
 * @author 0nika0
 */
contract ModularSwapRouter is IModularSwapRouter, AccessControl {
    bytes32 public constant MARGIN_ACCOUNT_ROLE = keccak256("MARGIN_ACCOUNT_ROLE");
    bytes32 public constant MARGIN_TRADING_ROLE = keccak256("MARGIN_TRADING_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    IMarginTrading public immutable marginTrading;

    constructor(
        IMarginTrading _marginTrading
    ) {
        marginTrading = _marginTrading;
        _setupRole(MARGIN_TRADING_ROLE, address(_marginTrading));
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    mapping(address => mapping(address => address)) public tokenInToTokenOutToExchange;

    // VIEW FUNCTINOS //

    function getModuleAddress(address tokenIn, address tokenOut) external view returns(address) {
        return tokenInToTokenOutToExchange[tokenIn][tokenOut];
    }

    // EXTERNAL FUNCTIONS //

    function calculatePositionValue(address tokenIn, address tokenOut, uint amountIn) external returns (uint amountOut) {
        address marginTradingBaseToken = marginTrading.BASE_TOKEN();
        if (tokenIn == marginTradingBaseToken && tokenOut == marginTradingBaseToken) {
            amountOut = amountIn;
        } else {
            address moduleAddress = tokenInToTokenOutToExchange[tokenIn][tokenOut];
            amountOut = IPositionManagerERC20(moduleAddress).getPositionValue(amountIn);
        }
    }

    function calculateAmountOutERC20(address tokenIn, address tokenOut, uint amountIn) external returns (uint amountOut) {
        address marginTradingBaseToken = marginTrading.BASE_TOKEN();
        if (tokenIn == marginTradingBaseToken && tokenOut == marginTradingBaseToken) {
            amountOut = amountIn;
        } else {
            address moduleAddress = tokenInToTokenOutToExchange[tokenIn][tokenOut];
            amountOut = IPositionManagerERC20(moduleAddress).getInputPositionValue(amountIn);
        }
    }

    function calculateAmountInERC20(address tokenIn, address tokenOut, uint amountOut) external returns (uint amountIn) {
        address marginTradingBaseToken = marginTrading.BASE_TOKEN();
        if (tokenIn == marginTradingBaseToken && tokenOut == marginTradingBaseToken) {
            amountIn = amountOut;
        } else {
            address moduleAddress = tokenInToTokenOutToExchange[tokenIn][tokenOut];
            amountIn = IPositionManagerERC20(moduleAddress).getOutputPositionValue(amountOut);
        }
    }

    function calculateAmountOutERC721(address tokenIn, address tokenOut, uint tokenID) external returns (uint amountOut) {
        address moduleAddress = tokenInToTokenOutToExchange[tokenIn][tokenOut];
        if (moduleAddress != address(0)) {
            amountOut = IPositionManagerERC721(moduleAddress).getOptionValue(tokenID);
        }
    }

    function checkValidityERC721(address tokenIn, address tokenOut, uint tokenID) external returns (bool isValid) {
        address moduleAddress = tokenInToTokenOutToExchange[tokenIn][tokenOut];
        if (moduleAddress != address(0)) {
            isValid = IPositionManagerERC721(moduleAddress).checkValidityERC721(tokenID);
        }
    }

    // ONLY MANAGER_ROLE FUNCTIONS //

    function setTokenInToTokenOutToExchange(address tokenIn, address tokenOut, address module) external onlyRole(MANAGER_ROLE) {
        tokenInToTokenOutToExchange[tokenIn][tokenOut] = module;
    }

    // ONLY MARGIN_TRADING_ROLE FUNCTIONS //

    function calculateTotalPositionValue(ERC20PositionInfo[] memory erc20Params, ERC721PositionInfo[] memory erc721Params) 
        external 
        onlyRole(MARGIN_TRADING_ROLE)
        returns (uint totalValue) 
    {
        address marginTradingBaseToken = marginTrading.BASE_TOKEN();
        for (uint i; i < erc20Params.length; i++) {
            address moduleAddress = tokenInToTokenOutToExchange[erc20Params[i].tokenIn][erc20Params[i].tokenOut];
            if (
                erc20Params[i].tokenIn == marginTradingBaseToken &&
                erc20Params[i].tokenOut == marginTradingBaseToken
            ) {
                totalValue += erc20Params[i].value;   
            } else if (moduleAddress != address(0)) {
                totalValue += IPositionManagerERC20(moduleAddress).getPositionValue(erc20Params[i].value);
            }
        }

        for (uint i; i < erc721Params.length; i++) {
            address moduleAddress = tokenInToTokenOutToExchange[erc721Params[i].tokenIn][erc721Params[i].tokenOut];
            if (moduleAddress != address(0)) {
                totalValue += IPositionManagerERC721(moduleAddress).getPositionValue(erc721Params[i].value);
            }
        }
    }

    // ONLY MARGIN_ACCOUNT_ROLE FUNCTIONS //

    function liquidate(ERC20PositionInfo[] memory erc20Params, ERC721PositionInfo[] memory erc721Params) 
        external
        onlyRole(MARGIN_ACCOUNT_ROLE)   
        returns(uint amountOut)  
    {
        address marginTradingBaseToken = marginTrading.BASE_TOKEN();
        for (uint i; i < erc20Params.length; i++) {
            address moduleAddress = tokenInToTokenOutToExchange[erc20Params[i].tokenIn][erc20Params[i].tokenOut];
            if (
                erc20Params[i].tokenIn == marginTradingBaseToken &&
                erc20Params[i].tokenOut == marginTradingBaseToken
            ) {
                amountOut += erc20Params[i].value;
            } else if (moduleAddress != address(0)  && erc20Params[i].value != 0) {
                amountOut += IPositionManagerERC20(moduleAddress).liquidate(erc20Params[i].value);
            }
        }

        for (uint i; i < erc721Params.length; i++) {
            address moduleAddress = tokenInToTokenOutToExchange[erc721Params[i].tokenIn][erc721Params[i].tokenOut];
            if (moduleAddress != address(0)) {
                amountOut += IPositionManagerERC721(moduleAddress).liquidate(erc721Params[i].value, erc721Params[i].holder);
            }
        }
    }

    function swapInput(address tokenIn, address tokenOut, uint amountIn, uint amountOutMinimum) 
        external
        onlyRole(MARGIN_ACCOUNT_ROLE) 
        returns(uint amountOut)
    {
        address marginTradingBaseToken = marginTrading.BASE_TOKEN();
        if (
            tokenIn == marginTradingBaseToken &&
            tokenOut == marginTradingBaseToken
        ) {
            return amountIn;
        }
        address moduleAddress = tokenInToTokenOutToExchange[tokenIn][tokenOut];
        return IPositionManagerERC20(moduleAddress).swapInput(amountIn, amountOutMinimum);
    }

    function swapOutput(address tokenIn, address tokenOut, uint amountOut) 
        external
        onlyRole(MARGIN_ACCOUNT_ROLE) 
        returns(uint amountIn)
    {
        address marginTradingBaseToken = marginTrading.BASE_TOKEN();
        if (
            tokenIn == marginTradingBaseToken &&
            tokenOut == marginTradingBaseToken
        ) {
            return amountOut;
        }
        address moduleAddress = tokenInToTokenOutToExchange[tokenIn][tokenOut];
        return IPositionManagerERC20(moduleAddress).swapOutput(amountOut);
    }

    function exercise(address tokenIn, address tokenOut, uint id) external onlyRole(MARGIN_ACCOUNT_ROLE) returns(uint amountOut) {
        address moduleAddress = tokenInToTokenOutToExchange[tokenIn][tokenOut];
        if (moduleAddress != address(0)) {
            amountOut = IPositionManagerERC721(moduleAddress).exercise(id);
        }
    }
}
