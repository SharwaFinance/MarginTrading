// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "../interfaces/ILiquidityPool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LiquidityPoolMock is ILiquidityPool {
    
    mapping(uint256 => uint256) public debtMap;
    address private token;

    constructor(address _token) {
    	token = _token;
    }

    function getDebtWithAccruedInterest(uint256 portfolioId) external view override returns (uint256 debtByPool) {
        return debtMap[portfolioId];
    }

    function borrow(uint256 portfolioId, uint256 amount) external override {
        debtMap[portfolioId] += amount;
        IERC20(token).transfer(msg.sender, amount);
    }
    
    function repay(uint256 portfolioId, uint256 amount) external override {
        uint256 currentDebt = debtMap[portfolioId];
        require(currentDebt >= amount, "Insufficient debt to repay");
        debtMap[portfolioId] -= amount;
        IERC20(token).transferFrom(msg.sender, address(this), amount); 
    }

    function provide(uint amount) external {}

    function setInsurancePool(address newInsurancePool) external {}

    function setInsuranceRateMultiplier(uint newInsuranceRateMultiplier) external {}

    function setInterestRate(uint newInterestRate) external {}

    function setMaximumBorrowMultiplier(uint newMaximumBorrowMultiplier) external {}

    function setMaximumPoolCapacity(uint newMaximumPoolCapacity) external {}

    function totalBorrows() external view returns (uint) {}

    function withdraw(uint amount) external {}

    function getDebtWithAccruedInterestOnTime(uint marginAccountID, uint checkTime) external view returns (uint debtByPool) {}

    function getTotalLiquidity() external view returns (uint) {}
}