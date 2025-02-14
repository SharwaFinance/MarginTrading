pragma solidity 0.8.20;

import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {QuoterMock} from "./QuoterMock.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Path} from "./Path.sol";

contract SwapRouterMock {
    using Path for bytes;

    QuoterMock public quoterMock;

    constructor(
        QuoterMock _quoterMock
    ) {
        quoterMock = _quoterMock;
    }

    function exactInput(ISwapRouter.ExactInputParams calldata params) external returns (uint256 amountOut) {
        (address tokenIn, address tokenOut, uint24 fee) = params.path.decodeFirstPool();
        amountOut = quoterMock.quoteExactInput(params.path, params.amountIn);
        ERC20(tokenIn).transferFrom(params.recipient, address(this), params.amountIn);
        ERC20(tokenOut).transfer(params.recipient, amountOut);
    }

    function exactOutput(ISwapRouter.ExactOutputParams calldata params) external payable returns (uint256 amountIn) {
        (address tokenIn, address tokenOut, uint24 fee) = params.path.decodeFirstPool();
        amountIn = quoterMock.quoteExactOutput(params.path, params.amountOut);
        ERC20(tokenOut).transferFrom(params.recipient, address(this), amountIn);
        ERC20(tokenIn).transfer(params.recipient, params.amountOut);
    }
}