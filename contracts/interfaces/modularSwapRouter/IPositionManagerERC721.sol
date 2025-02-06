pragma solidity 0.8.20;

interface IPositionManagerERC721 {

    // ONLY MODULAR_SWAP_ROUTER_ROLE FUNCTIONS //

    /**
     * @dev Liquidates multiple positions. 
     * @param value An array of position IDs to be liquidated.
     * @param holder The address of the account to transfer the positions to after liquidation.
     * @return amountOut The total amount of profit received from the liquidation in USDC.
     */
    function liquidate(uint marginAccountID, uint256[] memory value, address holder) external returns(uint amountOut);

    /**
     * @dev Executes the exercise of an option.
     * @param id The ID of the option being exercised.
     * @return amountOut The amount of base token received after exercising the option.
     */
    function exercise(uint id) external returns(uint amountOut);

    // EXTERNAL FUNCTIONS //

    /**
     * @notice Checks the validity of a given ERC721 token ID.
     * @param id The ID of the ERC721 token to check.
     * @return True if the token is valid (locked), false otherwise.
     */
    function checkValidityERC721(uint id) external returns(bool);

    // PUBLIC FUNCTIONS //

    /**
     * @notice Gets the value of a specified option ID.
     * @param id The ID of the option.
     * @return positionValue The value of the option.
     */
    function getOptionValue(uint id) external returns (uint positionValue);

    /**
     * @notice Gets the total value of specified option IDs.
     * @param value An array of option IDs.
     * @return positionValue The total value of the options.
     */    
    function getPositionValue(uint256[] memory value) external returns(uint positionValue);

    function getStrategy(uint id) external view returns(address);

    event LiquidateERC721(
        uint indexed marginAccountID,
        address indexed tokenIn,
        address indexed tokenOut,
        uint tokenId,
        uint amountOut
    );
}
    