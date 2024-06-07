pragma solidity 0.8.20;

interface IPositionManagerERC721 {

    // ONLY MODULAR_SWAP_ROUTER_ROLE FUNCTIONS //

    /**
     * @notice Executes the liquidation of specified Hegic options.
     * @dev This function can only be called by an account with the MODULAR_SWAP_ROUTER_ROLE.
     * @param value An array of option IDs to liquidate.
     * @return amountOut The total amount of tokens received from liquidation.
     */
    function liquidate(uint256[] memory value) external returns(uint amountOut);

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
    function getPositionValue(uint256[] memory value) external returns (uint positionValue);
}
    