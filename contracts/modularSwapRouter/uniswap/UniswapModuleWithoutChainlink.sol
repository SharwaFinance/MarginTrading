pragma solidity 0.8.20;

import {UniswapModuleBase, ISwapRouter, IQuoter, ERC20} from "./UniswapModuleBase.sol";

/**
 * @title UniswapModuleWithChainlink
 * @dev A module for managing token swaps and liquidity positions using Uniswap.
 * @notice This contract provides functions to facilitate token swaps and manage liquidity on Uniswap. 
 * It uses AccessControl for role-based access management and integrates with Uniswap's swap router and quoter.
 * @author 0nika0
 */
contract UniswapModuleWithoutChainlink is UniswapModuleBase {
    constructor(
        address _marginAccount,
        address _tokenInContract,
        address _tokenOutContract,
        ISwapRouter _swapRouter,
        IQuoter _quoter,
        bytes memory _uniswapPath
    ) UniswapModuleBase(
        _marginAccount,
        _tokenInContract,
        _tokenOutContract,
        _swapRouter,
        _quoter,
        _uniswapPath
    ) {}
}
