// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ILiquidityPool.sol";

contract MarginTradingMock {

    address public insurancePoolContract;
    ILiquidityPool public liquidityPool;

    function setInsurancePoolContract(address _insurancePoolContract) external {
        insurancePoolContract = _insurancePoolContract;
    }

    function setLiquidityPoolContract(address _liquidityPool) external {
        liquidityPool = ILiquidityPool(_liquidityPool);
    }

    function repay(uint256 portfolioId, uint256 amount, IERC20 usdc, uint256 amountReal) external {
        // This check is disabled to test the case when MarginTrading contract sends more tokens than necessary
        // require(amount >= amountReal, "MarginTrading contract error amount!");
        if (amount < amountReal) {
            // Remove the condition above if the require contract is enabled
        } else if (usdc.balanceOf(insurancePoolContract) >= amount - amountReal) {
            usdc.transferFrom(insurancePoolContract, address(this), amount - amountReal);
        }
        usdc.approve(address(liquidityPool), amountReal);
        liquidityPool.repay(portfolioId, amountReal);
    }

    function borrow(uint256 portfolioId, uint256 amount) external {
        liquidityPool.borrow(portfolioId, amount);
    }

}
