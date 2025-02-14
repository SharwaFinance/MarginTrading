pragma solidity 0.8.20;

import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Path} from "./Path.sol";

contract QuoterMock {
    using Path for bytes;

    mapping(address => mapping(address => uint256)) public swapPrice;

    function setSwapPrice(address tokenIn, address tokenOut, uint256 newPrice) external {
        swapPrice[tokenIn][tokenOut] = newPrice;
    }

    function quoteExactInput(bytes memory path, uint256 amountIn) external view returns (uint256 amountOut) {
        (address tokenIn, address tokenOut, uint24 fee ) = path.decodeFirstPool();
        require(swapPrice[tokenIn][tokenOut] > 0, "Invalid swap price");

        uint256 decimalsIn = ERC20(tokenIn).decimals();
        uint256 decimalsOut = ERC20(tokenOut).decimals();
        amountOut = amountIn * swapPrice[tokenIn][tokenOut] / (10**decimalsIn);
    }

    function quoteExactOutput(bytes memory path, uint256 amountOut) external view returns (uint256 amountIn) {
        (address tokenIn, address tokenOut, uint24 fee) = path.decodeFirstPool();
        require(swapPrice[tokenIn][tokenOut] > 0, "Invalid swap price");

        uint256 decimalsIn = 10**ERC20(tokenIn).decimals();
        uint256 decimalsOut = 10**ERC20(tokenOut).decimals();

        amountIn = amountOut * swapPrice[tokenIn][tokenOut] / decimalsIn;
    }
}