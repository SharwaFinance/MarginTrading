// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract MockAggregatorV3 is AggregatorV3Interface {

    uint8 public override decimals;
    int256 public mockAnswer;

    constructor(
        uint8 _decimals,
        int256 _mockAnswer
    ) {
        decimals = _decimals;
        mockAnswer = _mockAnswer;
    }

    function setAnswer(int256 _answer) external {
        mockAnswer = _answer;
    }

    function description() external override view returns (string memory) {}

    function version() external override view returns (uint256) {}

    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        roundId = _roundId;
        answer = mockAnswer;
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        answer = mockAnswer;
    }
}
