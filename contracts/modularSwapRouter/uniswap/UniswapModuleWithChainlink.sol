pragma solidity 0.8.20;

import {UniswapModuleBase, ISwapRouter, IQuoter, ERC20} from "./UniswapModuleBase.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {AggregatorV2V3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV2V3Interface.sol";


/**
 * @title UniswapModuleWithChainlink
 * @dev A module for managing token swaps and liquidity positions using Uniswap.
 * @notice This contract provides functions to facilitate token swaps and manage liquidity on Uniswap. 
 * It uses AccessControl for role-based access management and integrates with Uniswap's swap router and quoter.
 * @author 0nika0
 */
contract UniswapModuleWithChainlink is UniswapModuleBase {
    uint256 private constant GRACE_PERIOD_TIME = 3600;
    
    address public dataFeed;
    address public sequencerUptimeFeed;

    uint public priceUpdateThreshold = 3600;

    error SequencerDown();
    error GracePeriodNotOver();
    error PriceDataIsStale();

    constructor(
        address _marginAccount,
        address _tokenInContract,
        address _tokenOutContract,
        address _dataFeed,
        address _sequencerUptimeFeed, 
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
    ) {
        dataFeed = _dataFeed;
        sequencerUptimeFeed = _sequencerUptimeFeed;
    }

    // ONLY MANAGER_ROLE FUNTIONS //

    function setPriceUpdateThreshold(uint newPriceUpdateThreshold) external onlyRole(MANAGER_ROLE) {
        priceUpdateThreshold = newPriceUpdateThreshold;
    }

    // VIEW FUNCTIONS //

    function getPositionValue(uint256 amountIn) external override returns (uint amountOut) {
        require(dataFeed != address(0), "invalid module");
        uint latestPrice = getChainlinkDataFeedLatestAnswer();
        uint tokenInDecimals = ERC20(tokenInContract).decimals();
        uint tokenOutDecimals = ERC20(tokenOutContract).decimals();
        uint chainlinkDecimals = AggregatorV3Interface(dataFeed).decimals();
        require(chainlinkDecimals>tokenOutDecimals, "invalid tokenOut");
        uint diffDecimals = chainlinkDecimals-tokenOutDecimals;

        return amountIn*latestPrice/(10**tokenInDecimals)/(10**diffDecimals);
    }

    function getChainlinkDataFeedLatestAnswer() public view returns (uint) {
        (
            /*uint80 roundID*/,
            int256 answer,
            uint256 startedAt,
            /*uint256 updatedAt*/,
            /*uint80 answeredInRound*/
        ) = AggregatorV2V3Interface(sequencerUptimeFeed).latestRoundData();

        bool isSequencerUp = answer == 0;
        if (!isSequencerUp) {
            revert SequencerDown();
        }

        uint256 timeSinceUp = block.timestamp - startedAt;
        if (timeSinceUp <= GRACE_PERIOD_TIME) {
            revert GracePeriodNotOver();
        }

        (
            /*uint80 roundID*/,
            int data,
            /*uint startedAt*/,
            uint updatedAt,
            /*uint80 answeredInRound*/
        ) = AggregatorV3Interface(dataFeed).latestRoundData();

        require(data != 0, "invalid price");

        if(updatedAt < block.timestamp - priceUpdateThreshold) {
            revert PriceDataIsStale();
        }

        return uint256(data);
    }
}
