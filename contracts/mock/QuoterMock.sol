pragma solidity 0.8.20;

import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Path} from "./Path.sol";

contract QuoterMock {
    using Path for bytes;

    mapping(address => mapping(address => uint)) public swapPrice;

    function setSwapPrice(address tokeIn, address tokenOut, uint newPrice) external {
        swapPrice[tokeIn][tokenOut] = newPrice;
    }

    function quoteExactInput(bytes memory path, uint256 amountIn) external returns (uint256 amountOut) {
        (address tokenIn, address tokenOut, uint24 fee) = path.decodeFirstPool();
        amountOut = amountIn * swapPrice[tokenIn][tokenOut] / (10**ERC20(tokenIn).decimals()); 
    }

    function quoteExactOutput(bytes memory path, uint256 amountOut) external returns (uint256 amountIn) {
        (address tokenIn, address tokenOut, uint24 fee) = path.decodeFirstPool();
        amountIn = amountOut * (10**ERC20(tokenIn).decimals()) / swapPrice[tokenIn][tokenOut]; 
    }

}