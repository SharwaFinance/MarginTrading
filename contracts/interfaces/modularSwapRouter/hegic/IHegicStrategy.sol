pragma solidity 0.8.20;

interface IHegicStrategy {  
    /**
     * @param optionID The ID of the option.
     * @return The profit amount for the specified option.
     */
    function payOffAmount(uint256 optionID)
        external
        view
        returns (uint256);

    function calculateNegativepnlAndPositivepnl(
        uint256 amount,
        uint256 period,
        bytes[] calldata
    ) external view returns (uint128 negativepnl, uint128 positivepnl);
}