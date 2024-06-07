pragma solidity 0.8.20;

import {IModularSwapRouter} from "./interfaces/modularSwapRouter/IModularSwapRouter.sol";
import {IMarginAccount} from "./interfaces/IMarginAccount.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ILiquidityPool} from "./interfaces/ILiquidityPool.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MarginAccount
 * @dev This contract manages the storage of margin accounts, including ERC20 and ERC721 tokens.
 * It also handles interactions with liquidity pools and a modular swap router.
 * @author 0nika0
 */
contract MarginAccount is IMarginAccount, AccessControl {
    mapping(uint => mapping(address => uint)) private erc20ByContract;
    mapping(uint => mapping(address => uint[])) private erc721ByContract;

    mapping(address => bool) public isAvailableErc20;
    mapping(address => bool) public isAvailableErc721;

    address[] public availableErc20;
    address[] public availableErc721;

    mapping(address => address) public tokenToLiquidityPool;

    address[] public availableTokenToLiquidityPool;

    IModularSwapRouter public modularSwapRouter;
    address public insurancePool;

    bytes32 public constant MARGIN_TRADING_ROLE = keccak256("MARGIN_TRADING_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    constructor(
        address _insurancePool
    ) {
        insurancePool = _insurancePool;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // VIEW FUNCTIONS //

    function getAvailableErc20() public view returns (address[] memory tokensArray) {
        return availableErc20;
    }

    function getAvailableErc721() public view returns (address[] memory tokensArray) {
        return availableErc721;
    }

    function getAvailableTokenToLiquidityPool() public view returns (address[] memory tokensArray) {
        return availableTokenToLiquidityPool;
    }

    function getErc20ByContract(uint marginAccountID, address tokenAddress) public view returns (uint) {
        return erc20ByContract[marginAccountID][tokenAddress];
    }

    function getErc721ByContract(uint marginAccountID, address tokenAddress) public view returns (uint[] memory) {
        return erc721ByContract[marginAccountID][tokenAddress];
    }

    function checkERC721tokenID(uint marginAccountID, address token, uint value) public view returns(bool hasERC721Id) {
        uint[] memory userERC721 = new uint[](erc721ByContract[marginAccountID][token].length);
        userERC721 = erc721ByContract[marginAccountID][token];
        for (uint i; i < userERC721.length; i++) {
            if (userERC721[i] == value) {
                return true;
            }
        } 
    }

    function checkERC20Amount(uint marginAccountID, address token, uint amount) external view returns(bool currectBalance) {
        currectBalance = amount <= erc20ByContract[marginAccountID][token];
    }

    function checkERC721Value(uint marginAccountID, address token, uint value) external view returns (bool hasERC721Id) {
        hasERC721Id = checkERC721tokenID(marginAccountID, token, value);
    }

    function checkLiquidityPool(address token) external view returns (bool isValid) {
        address liquifityPoolAddress = tokenToLiquidityPool[token];
        isValid = liquifityPoolAddress != address(0);       
    }

    function preparationTokesParams(uint marginAccountID, address baseToken) public view returns (
        IModularSwapRouter.ERC20PositionInfo[] memory erc20Params, 
        IModularSwapRouter.ERC721PositionInfo[] memory erc721Params
    ) {
        erc20Params = new IModularSwapRouter.ERC20PositionInfo[](availableErc20.length);
        erc721Params = new IModularSwapRouter.ERC721PositionInfo[](availableErc721.length);
        for(uint i; i < availableErc20.length; i++) {
            uint erc20Balance = erc20ByContract[marginAccountID][availableErc20[i]];
            erc20Params[i] = IModularSwapRouter.ERC20PositionInfo(availableErc20[i], baseToken, erc20Balance);
        }

        for(uint i; i < availableErc721.length; i++) {
            uint[] memory erc721TokensByContract = erc721ByContract[marginAccountID][availableErc721[i]];
            erc721Params[i] = IModularSwapRouter.ERC721PositionInfo(availableErc721[i], baseToken, erc721TokensByContract);
        }
    }

    function preparationTokesParamsByDebt(uint marginAccountID, address baseToken) public view returns (
        IModularSwapRouter.ERC20PositionInfo[] memory erc20Params, 
        IModularSwapRouter.ERC721PositionInfo[] memory erc721Params
    ) {
        erc20Params = new IModularSwapRouter.ERC20PositionInfo[](availableTokenToLiquidityPool.length);
        for (uint i; i < availableTokenToLiquidityPool.length; i++) {
            address liquidityPoolAddress = tokenToLiquidityPool[availableTokenToLiquidityPool[i]];
            erc20Params[i] = IModularSwapRouter.ERC20PositionInfo(
                availableTokenToLiquidityPool[i],
                baseToken,
                ILiquidityPool(liquidityPoolAddress).getDebtWithAccruedInterest(marginAccountID)
            );
        }
    }

    // ONLY MANAGER_ROLE FUNCTIONS //

    function setModularSwapRouter(IModularSwapRouter newModularSwapRouter) external onlyRole(MANAGER_ROLE) {
        modularSwapRouter = newModularSwapRouter;

        emit UpdateModularSwapRouter(address(newModularSwapRouter));
    }

    function setTokenToLiquidityPool(address token, address liquidityPoolAddress) external onlyRole(MANAGER_ROLE) {
        tokenToLiquidityPool[token] = liquidityPoolAddress;

        emit UpdateTokenToLiquidityPool(token, liquidityPoolAddress);
    }

    function setAvailableTokenToLiquidityPool(address[] memory _availableTokenToLiquidityPool) external onlyRole(MANAGER_ROLE) {
        availableTokenToLiquidityPool = _availableTokenToLiquidityPool;

        emit UpdateAvailableTokenToLiquidityPool(_availableTokenToLiquidityPool);
    }

    function setAvailableErc20(address[] memory _availableErc20) external onlyRole(MANAGER_ROLE) {
        availableErc20 = _availableErc20;

        emit UpdateAvailableErc20(_availableErc20);
    }

    function setIsAvailableErc20(address token, bool value) external onlyRole(MANAGER_ROLE) {
        isAvailableErc20[token] = value;

        emit UpdateIsAvailableErc20(token, value);
    }
    
    function setAvailableErc721(address[] memory _availableErc721) external onlyRole(MANAGER_ROLE) {
        availableErc721 = _availableErc721;

        emit UpdateAvailableErc721(availableErc721);
    }

    function setIsAvailableErc721(address token, bool value) external onlyRole(MANAGER_ROLE) {
        isAvailableErc721[token] = value;

        emit UpdateIsAvailableErc721(token, value);
    }    

    function approveERC20(address token, address to, uint amount) external onlyRole(MANAGER_ROLE) {
        IERC20(token).approve(to, amount);
    }

    // ONLY MARGIN_TRADING_ROLE FUNCTIONS //

    function provideERC20(uint marginAccountID, address txSender, address token, uint amount) external onlyRole(MARGIN_TRADING_ROLE) {
        require(isAvailableErc20[token], "Token you are attempting to deposit is not available for deposit");
        erc20ByContract[marginAccountID][token] += amount;
        IERC20(token).transferFrom(txSender, address(this), amount);
    }

    function provideERC721(uint marginAccountID, address txSender, address token, uint collateralTokenID, address baseToken) external onlyRole(MARGIN_TRADING_ROLE) {
        require(isAvailableErc721[token], "Token you are attempting to deposit is not available for deposit");
        erc721ByContract[marginAccountID][token].push(collateralTokenID);
        IERC721(token).transferFrom(txSender, address(this), collateralTokenID);
        IERC721(token).approve(modularSwapRouter.getModuleAddress(token, baseToken), collateralTokenID);
    }

    function withdrawERC20(uint marginAccountID, address token, uint amount, address txSender) external onlyRole(MARGIN_TRADING_ROLE) {
        erc20ByContract[marginAccountID][token] -= amount;
        IERC20(token).transfer(txSender, amount);
    }

    function withdrawERC721(uint marginAccountID, address token, uint value, address txSender) external onlyRole(MARGIN_TRADING_ROLE) {
        _deleteERC721TokenFromContractList(marginAccountID, token, value);
        IERC721(token).transferFrom(address(this), txSender, value);
    }

    function borrow(uint marginAccountID, address token, uint amount) external onlyRole(MARGIN_TRADING_ROLE) {
        address liquifityPoolAddress = tokenToLiquidityPool[token];       
        require(liquifityPoolAddress != address(0), "Token is not supported");

        erc20ByContract[marginAccountID][token] += amount;
        ILiquidityPool(liquifityPoolAddress).borrow(marginAccountID, amount);
    }

    function repay(uint marginAccountID, address token, uint amount) external onlyRole(MARGIN_TRADING_ROLE) {
        require(amount <= erc20ByContract[marginAccountID][token], "Insufficient funds to repay the debt");

        address liquifityPoolAddress = tokenToLiquidityPool[token];    
        require(liquifityPoolAddress != address(0), "Token is not supported");
        uint debtWithAccruedInterest = ILiquidityPool(liquifityPoolAddress).getDebtWithAccruedInterest(marginAccountID);
        if (amount == 0 || amount > debtWithAccruedInterest) {
            amount = debtWithAccruedInterest;
        }
        
        erc20ByContract[marginAccountID][token] -= amount;
        ILiquidityPool(liquifityPoolAddress).repay(marginAccountID, amount);
    }

    function liquidate(uint marginAccountID, address baseToken) external onlyRole(MARGIN_TRADING_ROLE) {
        IModularSwapRouter.ERC20PositionInfo[] memory erc20Params = new IModularSwapRouter.ERC20PositionInfo[](availableErc20.length); 
        IModularSwapRouter.ERC721PositionInfo[] memory erc721Params = new IModularSwapRouter.ERC721PositionInfo[](availableErc721.length);

        for(uint i; i < availableErc20.length; i++) {
            uint erc20Balance = erc20ByContract[marginAccountID][availableErc20[i]];
            erc20Params[i] = IModularSwapRouter.ERC20PositionInfo(availableErc20[i], baseToken, erc20Balance);
            erc20ByContract[marginAccountID][availableErc20[i]] -= erc20Balance;
        }

        for(uint i; i < availableErc721.length; i++) {
            uint[] memory erc721TokensByContract = erc721ByContract[marginAccountID][availableErc721[i]];
            erc721Params[i] = IModularSwapRouter.ERC721PositionInfo(availableErc721[i], baseToken, erc721TokensByContract);
            delete erc721ByContract[marginAccountID][availableErc721[i]];
        }

        uint amountOutInUSDC = modularSwapRouter.liquidate(erc20Params,erc721Params);

        erc20ByContract[marginAccountID][baseToken] += amountOutInUSDC;

        _clearDebtsWithPools(marginAccountID, baseToken);
    }

    function swap(uint marginAccountID, uint swapID, address tokenIn, address tokenOut, uint amountIn, uint amountOutMinimum) external onlyRole(MARGIN_TRADING_ROLE){
        require(isAvailableErc20[tokenIn] && isAvailableErc20[tokenOut], "Token is not available");
        require(amountIn <= erc20ByContract[marginAccountID][tokenIn], "Insufficient funds for the swap");
        uint amountOut = modularSwapRouter.swapInput(tokenIn, tokenOut, amountIn, amountOutMinimum);
        erc20ByContract[marginAccountID][tokenIn] -= amountIn;
        erc20ByContract[marginAccountID][tokenOut] += amountOut;

        emit Swap(swapID, tokenIn, tokenOut, marginAccountID, amountIn, amountOut);
    }

    // PRIVATE FUNCTIONS //

    /**
     * @dev Deletes an ERC721 token from the contract's list for a margin account.
     * @param marginAccountID The ID of the margin account.
     * @param token The address of the ERC721 token.
     * @param tokenID The ID of the token to delete.
     */
    function _deleteERC721TokenFromContractList(uint marginAccountID, address token, uint tokenID) private {
        uint[] storage userTokesByContract = erc721ByContract[marginAccountID][token];

        for(uint i = 0; i < userTokesByContract.length; i++) {
            if(userTokesByContract[i] == tokenID) {
                userTokesByContract[i] = userTokesByContract[userTokesByContract.length - 1]; 
                userTokesByContract.pop(); 
                return;
            }
        }
    }

    /**
     * @dev Clears debts with liquidity pools for a margin account.
     * @param marginAccountID The ID of the margin account.
     * @param baseToken The base token address.
     */
    function _clearDebtsWithPools(uint marginAccountID, address baseToken) private {
        for (uint i; i < availableTokenToLiquidityPool.length; i++) {
            address liquidityPoolAddress = tokenToLiquidityPool[availableTokenToLiquidityPool[i]];   
            uint poolDebt = ILiquidityPool(liquidityPoolAddress).getDebtWithAccruedInterest(marginAccountID);
            if (poolDebt != 0) {
                uint amountInUSDC = modularSwapRouter.calculateAmountInERC20(baseToken, availableTokenToLiquidityPool[i], poolDebt);
                uint userUSDCbalance = getErc20ByContract(marginAccountID, baseToken);
                if (amountInUSDC > userUSDCbalance) {
                    uint amountOut = modularSwapRouter.swapInput(baseToken, availableTokenToLiquidityPool[i], userUSDCbalance, 0);
                    erc20ByContract[marginAccountID][baseToken] -= userUSDCbalance;
                    IERC20(availableTokenToLiquidityPool[i]).transferFrom(insurancePool, address(this), poolDebt-amountOut); 
                } else {
                    uint amountIn = modularSwapRouter.swapOutput(baseToken, availableTokenToLiquidityPool[i], poolDebt);
                    erc20ByContract[marginAccountID][baseToken] -= amountIn;
                }
                ILiquidityPool(liquidityPoolAddress).repay(marginAccountID, poolDebt);
            }
        }
    }
}
