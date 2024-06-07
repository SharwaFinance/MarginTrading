pragma solidity 0.8.20;

interface IModularSwapRouter {
    struct ModuleData {
        address tokenIn;
        address tokenOut;
    }

    struct ERC20PositionInfo {
        address tokenIn;
        address tokenOut;
        uint256 value;
    }

    struct ERC721PositionInfo {
        address tokenIn;
        address tokenOut;
        uint256[] value;
    }

    // VIEW FUNCTINOS //

    /**
     * @notice Retrieves the module address for a given token pair.
     * @param tokenIn The address of the input token.
     * @param tokenOut The address of the output token.
     * @return The address of the module handling the swap for the given token pair.
     */
    function getModuleAddress(address tokenIn, address tokenOut) external view returns(address);

    // EXTERNAL FUNCTIONS //

    /**
     * @notice Calculates the output amount for a given input amount in an ERC20 swap.
     * @param tokenIn The address of the input token.
     * @param tokenOut The address of the output token.
     * @param amountIn The input amount.
     * @return amountOut The calculated output amount.
     */
    function calculateAmountOutERC20(address tokenIn, address tokenOut, uint amountIn) external returns (uint amountOut);

    /**
     * @notice Calculates the input amount required for a given output amount in an ERC20 swap.
     * @param tokenIn The address of the input token.
     * @param tokenOut The address of the output token.
     * @param amountOut The desired output amount.
     * @return amountIn The calculated input amount.
     */
    function calculateAmountInERC20(address tokenIn, address tokenOut, uint amountOut) external returns (uint amountIn);

    /**
     * @notice Calculates the output amount for a given input amount in an ERC721 swap.
     * @param tokenIn The address of the input token.
     * @param tokenOut The address of the output token.
     * @param tokenID The ID of the token.
     * @return amountOut The calculated output amount.
     */
    function calculateAmountOutERC721(address tokenIn, address tokenOut, uint tokenID) external returns (uint amountOut);

    /**
     * @notice Checks the validity of a given ERC721 token ID for a swap.
     * @param tokenIn The address of the input token.
     * @param tokenOut The address of the output token.
     * @param tokenID The ID of the token.
     * @return isValid True if the token is valid for the swap, false otherwise.
     */
    function checkValidityERC721(address tokenIn, address tokenOut, uint tokenID) external returns (bool isValid);

    // ONLY MANAGER_ROLE FUNCTIONS //

    /**
     * @notice Sets the module address for a given token pair.
     * @dev This function can only be called by an account with the MANAGER_ROLE.
     * @param tokenIn The address of the input token.
     * @param tokenOut The address of the output token.
     * @param module The address of the module handling the swap for the given token pair.
     */
    function setTokenInToTokenOutToExchange(address tokenIn, address tokenOut, address module) external;

    // ONLY MARGIN_TRADING_ROLE FUNCTIONS //

    /**
     * @notice Calculates the total value of provided ERC20 and ERC721 positions.
     * @dev This function can only be called by an account with the MARGIN_TRADING_ROLE.
     * @param erc20Params Array of ERC20PositionInfo structs containing ERC20 position details.
     * @param erc721Params Array of ERC721PositionInfo structs containing ERC721 position details.
     * @return totalValue The total value of provided ERC20 and ERC721 positions.
     */
    function calculateTotalPositionValue(ERC20PositionInfo[] memory erc20Params, ERC721PositionInfo[] memory erc721Params) external returns (uint totalValue);

    // ONLY MARGIN_ACCOUNT_ROLE FUNCTIONS //

    /**
     * @notice Liquidates provided ERC20 and ERC721 positions.
     * @dev This function can only be called by an account with the MARGIN_ACCOUNT_ROLE.
     * @param erc20Params Array of ERC20PositionInfo structs containing ERC20 position details.
     * @param erc721Params Array of ERC721PositionInfo structs containing ERC721 position details.
     * @return amountOut The total amount of tokens received from liquidation.
     */
    function liquidate(ERC20PositionInfo[] memory erc20Params, ERC721PositionInfo[] memory erc721Params) external returns(uint amountOut);

    /**
     * @notice Swaps ERC20 tokens for ERC20 tokens.
     * @dev This function can only be called by an account with the MARGIN_ACCOUNT_ROLE.
     * @param tokenIn The address of the input token.
     * @param tokenOut The address of the output token.
     * @param amountIn The input amount.
     * @param amountOutMinimum The minimum output amount expected.
     * @return amountOut The output amount received from the swap.
     */
    function swapInput(address tokenIn, address tokenOut, uint amountIn, uint amountOutMinimum) external returns(uint amountOut);

    /**
     * @notice Swaps ERC20 tokens for ERC20 tokens.
     * @dev This function can only be called by an account with the MARGIN_ACCOUNT_ROLE.
     * @param tokenIn The address of the input token.
     * @param tokenOut The address of the output token.
     * @param amountOut The output amount.
     * @return amountIn The input amount required for the swap.
     */
    function swapOutput(address tokenIn, address tokenOut, uint amountOut) external returns(uint amountIn);
}
