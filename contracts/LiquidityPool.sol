// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ILiquidityPool} from"./interfaces/ILiquidityPool.sol";
import {UD60x18, ud, convert, intoUint256, pow, div} from "@prb/math/src/UD60x18.sol";

/**
 * @title LiquidityPool
 * @dev This contract manages a liquidity pool for ERC20 tokens, allowing users to provide liquidity, borrow, and repay loans.
 * @notice Users can deposit tokens to earn interest and borrow against their deposits.
 * @author 0nika0
 */
contract LiquidityPool is ERC20, ERC20Burnable, AccessControl, ILiquidityPool {
    uint private constant ONE_YEAR_SECONDS = 31536000;
    uint private constant INTEREST_RATE_COEFFICIENT = 1e4;
    bytes32 public constant MARGIN_ACCOUNT_ROLE = keccak256("MARGIN_ACCOUNT_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    ERC20 public immutable baseToken;
    ERC20 public immutable poolToken;

    uint public totalBorrowsSnapshotTimestamp;
    uint public depositShare;
    uint public debtSharesSum;
    uint public netDebt;
    uint public totalInterestSnapshot;
    uint public maximumPoolCapacity;

    mapping(uint => uint) public portfolioIdToDebt;

    mapping(uint => uint) public shareOfDebt;

    address public insurancePool;

    uint public interestRate = 0.05*1e4;
    uint public insuranceRateMultiplier = 0.05*1e4;
    uint public maximumBorrowMultiplier = 0.8*1e4;

    constructor(
        address _insurancePool,
        address _marginAccountStorage,
        ERC20 _baseToken,
        ERC20 _poolToken,
        string memory _tokenName,
        string memory _tokenSymbol,
        uint _poolCapacity
    ) ERC20(_tokenName, _tokenSymbol) {
        insurancePool = _insurancePool;
        baseToken = _baseToken;
        poolToken = _poolToken;
        totalBorrowsSnapshotTimestamp = block.timestamp;
        maximumPoolCapacity = _poolCapacity;
        _grantRole(MARGIN_ACCOUNT_ROLE, _marginAccountStorage);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ONLY MANAGER_ROLE FUNCTIONS //

    function setMaximumPoolCapacity(uint newMaximumPoolCapacity) external onlyRole(MANAGER_ROLE) {
        maximumPoolCapacity = newMaximumPoolCapacity;

        emit UpdateMaximumPoolCapacity(newMaximumPoolCapacity);
    }

    function setMaximumBorrowMultiplier(uint newMaximumBorrowMultiplier) external onlyRole(MANAGER_ROLE) {
        maximumBorrowMultiplier = newMaximumBorrowMultiplier;

        emit UpdateMaximumBorrowMultiplier(newMaximumBorrowMultiplier);
    }

    function setInsurancePool(address newInsurancePool) external onlyRole(MANAGER_ROLE) {
        insurancePool = newInsurancePool;

        emit UpdateInsurancePool(newInsurancePool);
    }

    function setInsuranceRateMultiplier(uint newInsuranceRateMultiplier) external onlyRole(MANAGER_ROLE) {
        insuranceRateMultiplier = newInsuranceRateMultiplier;

        emit UpdateInsuranceRateMultiplier(newInsuranceRateMultiplier);
    }

    function setInterestRate(uint newInterestRate) external onlyRole(MANAGER_ROLE) {
        require(newInterestRate > 0, "The interest rate cannot be zero!");
        uint newTotalBorrows = _fixAccruedInterest();
        interestRate = newInterestRate;

        emit UpdateInterestRate(getTotalLiquidity(), newTotalBorrows, interestRate);
    }

    // EXTERNAL FUNCTIONS //

    function provide(uint amount) external {
        uint totalLiquidity = getTotalLiquidity();
        require(
            totalLiquidity + amount <= maximumPoolCapacity,
            "Maximum liquidity has been achieved!"
        );
        poolToken.transferFrom(msg.sender, address(this), amount);
        uint shareChange = totalLiquidity > 0
            ? (depositShare * amount) / totalLiquidity
            : (amount * 10 ** decimals()) / 10 ** poolToken.decimals();
        _mint(msg.sender, shareChange);
        depositShare += shareChange;

        emit Provide(msg.sender, shareChange, amount);
    }

    function withdraw(uint amount) external {
        uint totalLiquidity = poolToken.balanceOf(address(this)) + netDebt;
        require(totalLiquidity != 0, "Liquidity pool has no pool tokens");
        uint amountWithdraw = (amount * totalLiquidity) / depositShare;
        require(
            poolToken.balanceOf(address(this)) >= amountWithdraw,
            "Liquidity pool has not enough free tokens!"
        );
        _burn(msg.sender, amount);
        depositShare -= amount;
        poolToken.transfer(msg.sender, amountWithdraw);

        emit Withdraw(msg.sender, amount, amountWithdraw);
    }

    // ONLY MARGIN_ACCOUNT_ROLE FUNCTIONS //

    function borrow(uint marginAccountID, uint amount) external onlyRole(MARGIN_ACCOUNT_ROLE) {
        require(
            poolToken.balanceOf(address(this)) >= amount,
            "There are not enough tokens in the liquidity pool to provide a loan!"
        );
        uint borrows = _fixAccruedInterest();
        require(
            borrows + amount <=
                ((borrows + poolToken.balanceOf(address(this)))  * maximumBorrowMultiplier) /
                    INTEREST_RATE_COEFFICIENT,
            "Limit is exceed!"
        );
        uint newDebtShare = borrows > 0
            ? (debtSharesSum * amount) / borrows
            : (amount * 10 ** decimals()) / 10 ** poolToken.decimals();
        
        debtSharesSum += newDebtShare;
        shareOfDebt[marginAccountID] += newDebtShare;
        netDebt += amount;
        portfolioIdToDebt[marginAccountID] += amount;
        poolToken.transfer(msg.sender, amount);

        emit Borrow(marginAccountID, amount);
    }

    function repay(uint marginAccountID, uint amount) external onlyRole(MARGIN_ACCOUNT_ROLE) {
        uint newTotalBorrows = totalBorrows();
        uint newTotalInterestSnapshot = newTotalBorrows - netDebt;
        uint accruedInterest = (newTotalInterestSnapshot * shareOfDebt[marginAccountID]) / debtSharesSum; // Accrued interest only
        uint debt = portfolioIdToDebt[marginAccountID] + accruedInterest;
        if (debt < amount) {
            // If you try to return more tokens than were borrowed, the required amount will be taken to repay the debt, the rest will remain untouched
            amount = debt;
        }
        uint shareChange = (amount * debtSharesSum) / newTotalBorrows; // Trader's share to be given away
        uint profit = (accruedInterest * shareChange) / shareOfDebt[marginAccountID];
        uint profitInsurancePool = (profit * insuranceRateMultiplier) / INTEREST_RATE_COEFFICIENT;
        totalInterestSnapshot -= totalInterestSnapshot * shareChange / debtSharesSum;
        debtSharesSum -= shareChange;
        shareOfDebt[marginAccountID] -= shareChange;
        if (debt > amount) {
            uint tempDebt = (portfolioIdToDebt[marginAccountID] * (debt - amount)) / debt;
            netDebt = netDebt - (portfolioIdToDebt[marginAccountID] - tempDebt);
            portfolioIdToDebt[marginAccountID] = tempDebt;
        } else {
            netDebt -= portfolioIdToDebt[marginAccountID];
            portfolioIdToDebt[marginAccountID] = 0;
        }
        if (profitInsurancePool > 0) {
            poolToken.transfer(insurancePool, profitInsurancePool);
        }
        poolToken.transferFrom(msg.sender, address(this), amount);

        emit Repay(marginAccountID, amount, profit);
    }

    // VIEW FUNCTIONS //

    function getDebtWithAccruedInterestOnTime(uint marginAccountID, uint checkTime) external view returns (uint debtByPool) {
        require(
            totalBorrowsSnapshotTimestamp < checkTime,
            "The function is designed to calculate future debt!"
        );
        if (debtSharesSum == 0) return 0;
        uint precision = 10 ** 18;
        UD60x18 temp = div(
            convert(
                ((INTEREST_RATE_COEFFICIENT + interestRate) *
                    precision) / INTEREST_RATE_COEFFICIENT
            ),
            convert(precision)
        );
        uint newTotalBorrow = ((netDebt + totalInterestSnapshot) *
                intoUint256(pow(temp, div(convert(checkTime - totalBorrowsSnapshotTimestamp), convert(ONE_YEAR_SECONDS))))) / 1e18;
        return (newTotalBorrow * shareOfDebt[marginAccountID]) / debtSharesSum;
    }

    function getDebtWithAccruedInterest(uint marginAccountID) external view returns (uint debtByPool) {
        if (debtSharesSum == 0) return 0;
        return (totalBorrows() * shareOfDebt[marginAccountID]) / debtSharesSum;
    }

    // PUBLIC FUNCTIONS //

    function totalBorrows() public view returns (uint) {
        uint ownershipTime = block.timestamp - totalBorrowsSnapshotTimestamp;
        uint precision = 10 ** 18;
        UD60x18 temp = div(
            convert(
                ((INTEREST_RATE_COEFFICIENT + interestRate) *
                    precision) / INTEREST_RATE_COEFFICIENT
            ),
            convert(precision)
        );
        return
            ((netDebt + totalInterestSnapshot) *
                intoUint256(pow(temp, div(convert(ownershipTime), convert(ONE_YEAR_SECONDS))))) / 1e18;
    }

    function getTotalLiquidity() public view returns (uint) {
        return poolToken.balanceOf(address(this)) + totalBorrows();
    }

    // PRIVATE FUNCTIONS //

    /**
     * @notice Charges interest rate to traders.
     * @return newTotalBorrows The new total borrows after interest accrual.
     */
    function _fixAccruedInterest() private returns (uint) {
        uint newTotalBorrows = totalBorrows();
        totalInterestSnapshot = newTotalBorrows - netDebt;
        totalBorrowsSnapshotTimestamp = block.timestamp;
        return newTotalBorrows;
    }
}
