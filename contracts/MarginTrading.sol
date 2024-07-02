pragma solidity 0.8.20;

import {IModularSwapRouter} from "./interfaces/modularSwapRouter/IModularSwapRouter.sol";
import {IMarginAccountManager} from "./interfaces/IMarginAccountManager.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IMarginAccount} from "./interfaces/IMarginAccount.sol";
import {IMarginTrading} from "./interfaces/IMarginTrading.sol";
import {ILiquidityPool} from "./interfaces/ILiquidityPool.sol";

/**
 * @title MarginTrading
 * @notice This contract allows users to manage margin accounts, provide collateral, borrow, and repay tokens.
 * @dev The contract uses modular architecture with separate modules for swap routing, margin account management, and storage.
 * It also includes access control mechanisms for managing roles and permissions.
 * @author 0nika0
 */
contract MarginTrading is IMarginTrading, AccessControl, ReentrancyGuard {
    uint private constant COEFFICIENT_DECIMALS = 1e5;

    address public immutable BASE_TOKEN;

    uint public yellowCoeff = 1.10 * 1e5;
    uint public redCoeff = 1.05 * 1e5; 
    uint public swapID = 0;

    IModularSwapRouter public modularSwapRouter;
    IMarginAccountManager public immutable marginAccountManager;
    IMarginAccount public immutable marginAccount;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant LIQUIDATOR_ROLE = keccak256("LIQUIDATOR_ROLE");

    constructor(
        address _positionsManager,
        address _baseToken,
        address _portfolioLendingStorage
    ) {
        BASE_TOKEN = _baseToken;
        marginAccountManager = IMarginAccountManager(_positionsManager);
        marginAccount = IMarginAccount(_portfolioLendingStorage);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Modifier to check if the caller is approved or the owner of the margin account.
     * @param marginAccountID The ID of the margin account.
     */
    modifier onlyApprovedOrOwner(uint marginAccountID) {
        require(marginAccountManager.isApprovedOrOwner(msg.sender, marginAccountID), "You are not the owner of the token");
        _;
    }

    // ONLY MANAGER_ROLE FUNCTIONS //

    function setModularSwapRouter(IModularSwapRouter newModularSwapRouter) external onlyRole(MANAGER_ROLE) {
        modularSwapRouter = newModularSwapRouter;
        emit UpdateModularSwapRouter(address(newModularSwapRouter));
    }

    function setRedCoeff(uint newRedCoeff) external onlyRole(MANAGER_ROLE) {
        redCoeff = newRedCoeff;
        emit UpdateRedCoeff(newRedCoeff);
    }

    function setYellowCoeff(uint newYellowCoeff) external onlyRole(MANAGER_ROLE) {
        yellowCoeff = newYellowCoeff;
        emit UpdateYellowCoeff(newYellowCoeff);
    }

    // PUBLIC FUNCTIONS //

    function calculateMarginAccountValue(uint marginAccountID) public returns (uint marginAccountValue) {
        (
            IModularSwapRouter.ERC20PositionInfo[] memory erc20Params, 
            IModularSwapRouter.ERC721PositionInfo[] memory erc721Params
        ) = prepareTokensParams(marginAccountID, BASE_TOKEN);
        marginAccountValue = modularSwapRouter.calculateTotalPositionValue(erc20Params,erc721Params);
    }

    function calculateDebtWithAccruedInterest(uint marginAccountID) public returns (uint debtSizeInUSDC) {
        (
            IModularSwapRouter.ERC20PositionInfo[] memory erc20Params, 
            IModularSwapRouter.ERC721PositionInfo[] memory erc721Params
        ) = prepareTokensParamsByDebt(marginAccountID, BASE_TOKEN);
        debtSizeInUSDC += modularSwapRouter.calculateTotalPositionValue(erc20Params, erc721Params);
    }

    function getMarginAccountRatio(uint marginAccountID) public returns(uint) {
        uint marginAccountValue = calculateMarginAccountValue(marginAccountID);
        uint debtWithAccruedInterest = calculateDebtWithAccruedInterest(marginAccountID);
        return _calculatePortfolioRatio(marginAccountValue, debtWithAccruedInterest);
    }

    // ONLY APPROVE OR OWNER FUNCTIONS //


    function provideERC20(uint marginAccountID, address token, uint amount) external nonReentrant onlyApprovedOrOwner(marginAccountID) {
        marginAccount.provideERC20(marginAccountID, msg.sender, token, amount);

        emit ProvideERC20(marginAccountID, msg.sender, token, amount);
    }


    function provideERC721(uint marginAccountID, address token, uint collateralTokenID) external nonReentrant onlyApprovedOrOwner(marginAccountID) {
        require(modularSwapRouter.checkValidityERC721(token, BASE_TOKEN, collateralTokenID), "token id is not valid");
        marginAccount.provideERC721(marginAccountID, msg.sender, token, collateralTokenID);

        emit ProvideERC721(marginAccountID, msg.sender, token, collateralTokenID);
    }

    function withdrawERC20(uint marginAccountID, address token, uint amount) external nonReentrant onlyApprovedOrOwner(marginAccountID) {
        require(marginAccount.checkERC20Amount(marginAccountID, token, amount), "Insufficient token balance for withdrawal");
        uint marginAccountValue = calculateMarginAccountValue(marginAccountID);

        uint withdrawSizeInBaseToken = modularSwapRouter.calculatePositionValue(token, BASE_TOKEN, amount);
        marginAccountValue -= withdrawSizeInBaseToken;
        uint debtWithAccruedInterest = calculateDebtWithAccruedInterest(marginAccountID);
        uint portfolioRatio = _calculatePortfolioRatio(marginAccountValue, debtWithAccruedInterest);
        require(portfolioRatio > yellowCoeff, "portfolioRatio is too low");
        marginAccount.withdrawERC20(marginAccountID, token, amount, msg.sender);

        emit WithdrawERC20(marginAccountID, msg.sender, token, amount);
    }

    function withdrawERC721(uint marginAccountID, address token, uint value) external nonReentrant onlyApprovedOrOwner(marginAccountID) {
        require(marginAccount.checkERC721Value(marginAccountID, token, value), "The ERC721 token you are attempting to withdraw is not available for withdrawal");

        uint marginAccountValue = calculateMarginAccountValue(marginAccountID);

        uint withdrawSizeInBaseToken = modularSwapRouter.calculateAmountOutERC721(token, BASE_TOKEN, value);
        marginAccountValue -= withdrawSizeInBaseToken;

        uint debtWithAccruedInterest = calculateDebtWithAccruedInterest(marginAccountID);
        uint portfolioRatio = _calculatePortfolioRatio(marginAccountValue, debtWithAccruedInterest);

        require(portfolioRatio > yellowCoeff, "portfolioRatio is too low");

        marginAccount.withdrawERC721(marginAccountID, token, value, msg.sender);

        emit WithdrawERC721(marginAccountID, msg.sender, token, value);
    }

    function borrow(uint marginAccountID, address token, uint amount) external nonReentrant onlyApprovedOrOwner(marginAccountID) {
        require(marginAccount.checkLiquidityPool(token), "Token is not supported");
        uint amountInBaseToken = modularSwapRouter.calculatePositionValue(token, BASE_TOKEN, amount);
        uint marginAccountValue = calculateMarginAccountValue(marginAccountID);
        uint debtWithAccruedInterest = calculateDebtWithAccruedInterest(marginAccountID);
        uint marginAccountRatio = _calculatePortfolioRatio(marginAccountValue + amountInBaseToken, debtWithAccruedInterest + amountInBaseToken);
        require(marginAccountRatio >= yellowCoeff, "Cannot borrow more; margin account ratio is too high"); 

        marginAccount.borrow(marginAccountID, token, amount);

        emit Borrow(marginAccountID, msg.sender, token, amount);
    }

    function repay(uint marginAccountID, address token, uint amount) external nonReentrant onlyApprovedOrOwner(marginAccountID) {
        marginAccount.repay(marginAccountID, token, amount);

        emit Repay(marginAccountID, msg.sender, token, amount);
    }

    function swap(uint marginAccountID, address tokenIn, address tokenOut, uint amountIn, uint amountOutMinimum) external nonReentrant onlyApprovedOrOwner(marginAccountID) {
        uint marginAccountValue = calculateMarginAccountValue(marginAccountID);
        uint debtWithAccruedInterest = calculateDebtWithAccruedInterest(marginAccountID);
        uint marginAccountRatio = _calculatePortfolioRatio(marginAccountValue, debtWithAccruedInterest);
        require(marginAccountRatio >= redCoeff, "Cannot swap"); 
        emit Swap(marginAccountID, swapID, tokenIn, tokenOut, amountIn);

        marginAccount.swap(marginAccountID, swapID, tokenIn, tokenOut, amountIn, amountOutMinimum);

        swapID++;
    }

    function exercise(uint marginAccountID, address token, uint collateralTokenID) external nonReentrant onlyApprovedOrOwner(marginAccountID)  {
        require(marginAccount.checkERC721Value(marginAccountID, token, collateralTokenID), "You are not allowed to execute this ERC721 token");

        marginAccount.exercise(marginAccountID, token, BASE_TOKEN, collateralTokenID, msg.sender);

        emit Exercise(marginAccountID, token, BASE_TOKEN, collateralTokenID);
    }

    // ONLY LIQUIDATOR_ROLE FUNCTIONS //
    
    function liquidate(uint marginAccountID) external onlyRole(LIQUIDATOR_ROLE) {
        uint ratio = getMarginAccountRatio(marginAccountID);
        require(ratio > 0, "Margin Account is debt-free");
        require(ratio <= redCoeff, "Margin Account ratio is too high to execute liquidation");
        marginAccount.liquidate(marginAccountID, BASE_TOKEN, marginAccountManager.ownerOf(marginAccountID), msg.sender);

        emit Liquidate(marginAccountID, msg.sender);
    }

    // PRIIVATE FUNCTIONS //

    /**
     * @dev Calculates the margin account ratio.
     * @param marginAccountValue The total value of the margin account.
     * @param debtWithAccruedInterest The total debt with accrued interest.
     * @return marginAccountRatio The calculated margin account ratio.
     */
    function _calculatePortfolioRatio(uint marginAccountValue, uint debtWithAccruedInterest) private pure returns (uint marginAccountRatio) {
        if (debtWithAccruedInterest == 0) {
            return type(uint256).max;
        }
        marginAccountRatio = marginAccountValue*COEFFICIENT_DECIMALS/debtWithAccruedInterest;
    }

    function prepareTokensParams(uint marginAccountID, address baseToken) public view returns (
        IModularSwapRouter.ERC20PositionInfo[] memory erc20Params, 
        IModularSwapRouter.ERC721PositionInfo[] memory erc721Params
    ) {
        address[] memory availableErc20 = marginAccount.getAvailableErc20();
        address[] memory availableErc721 = marginAccount.getAvailableErc721();
        erc20Params = new IModularSwapRouter.ERC20PositionInfo[](availableErc20.length);
        erc721Params = new IModularSwapRouter.ERC721PositionInfo[](availableErc721.length);
        for(uint i; i < availableErc20.length; i++) {
            uint erc20Balance = marginAccount.getErc20ByContract(marginAccountID, availableErc20[i]);
            erc20Params[i] = IModularSwapRouter.ERC20PositionInfo(availableErc20[i], baseToken, erc20Balance);
        }

        for(uint i; i < availableErc721.length; i++) {
            uint[] memory erc721TokensByContract = marginAccount.getErc721ByContract(marginAccountID, availableErc721[i]);
            erc721Params[i] = IModularSwapRouter.ERC721PositionInfo(availableErc721[i], baseToken, address(0), erc721TokensByContract);
        }
    }

    function prepareTokensParamsByDebt(uint marginAccountID, address baseToken) public view returns (
        IModularSwapRouter.ERC20PositionInfo[] memory erc20Params, 
        IModularSwapRouter.ERC721PositionInfo[] memory erc721Params
    ) {
        address[] memory availableTokenToLiquidityPool = marginAccount.getAvailableTokenToLiquidityPool();
        erc20Params = new IModularSwapRouter.ERC20PositionInfo[](availableTokenToLiquidityPool.length);
        for (uint i; i < availableTokenToLiquidityPool.length; i++) {
            address liquidityPoolAddress = marginAccount.tokenToLiquidityPool(availableTokenToLiquidityPool[i]);
            erc20Params[i] = IModularSwapRouter.ERC20PositionInfo(
                availableTokenToLiquidityPool[i],
                baseToken,
                ILiquidityPool(liquidityPoolAddress).getDebtWithAccruedInterest(marginAccountID)
            );
        }
    }
}
