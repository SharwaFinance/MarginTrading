pragma solidity 0.8.20;

import {IPositionManagerERC20} from "../../interfaces/modularSwapRouter/IPositionManagerERC20.sol"; 
import {IQuoter} from "../../interfaces/modularSwapRouter/uniswap/IQuoter.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/**
 * @title UniswapModule
 * @dev A module for managing token swaps and liquidity positions using Uniswap.
 * @notice This contract provides functions to facilitate token swaps and manage liquidity on Uniswap. 
 * It uses AccessControl for role-based access management and integrates with Uniswap's swap router and quoter.
 * @author 0nika0
 */
contract UniswapModule is IPositionManagerERC20, AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant MODULAR_SWAP_ROUTER_ROLE = keccak256("MODULAR_SWAP_ROUTER_ROLE");

    address public marginAccount;

    bytes public uniswapPath;

    address public tokenInContract;
    address public tokenOutContract;

    ISwapRouter public swapRouter;
    IQuoter public quoter;

    constructor(
        address _marginAccount,
        address _tokenInContract,
        address _tokenOutContract,
        ISwapRouter _swapRouter,
        IQuoter _quoter,
        bytes memory _uniswapPath
    ) {
        marginAccount = _marginAccount;
        tokenInContract = _tokenInContract;
        tokenOutContract = _tokenOutContract;
        swapRouter = _swapRouter;
        quoter = _quoter;
        uniswapPath = _uniswapPath;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ONLY MANAGER_ROLE FUNTIONS //

    /**
     * @notice Updates the Uniswap path used for swaps.
     * @dev This function can only be called by an account with the MANAGER_ROLE.
     * @param newPath The new path to set for Uniswap swaps.
     */
    function setUniswapPath(bytes memory newPath) external onlyRole(MANAGER_ROLE) {
        uniswapPath = newPath;
    }

    // VIEW FUNCTIONS //

    function getInputPositionValue(uint256 amountIn) external returns (uint amountOut) {
        ISwapRouter.ExactInputParams memory params = _preparationInputParams(amountIn);

        amountOut = quoter.quoteExactInput(params.path, amountIn);
    }

    function getOutputPositionValue(uint256 amountOut) public returns (uint amountIn) {
        ISwapRouter.ExactOutputParams memory params = _preparationOutputParams(amountOut);

        amountIn = quoter.quoteExactOutput(params.path, amountOut);
    }

    // EXTERNAL FUNCTION //

    /**
     * @notice Approves the maximum amount of the input token to be spent by the swap router.
     * @dev This function can be called by any account.
     */
    function allApprove() external {
        IERC20(tokenInContract).approve(address(swapRouter), type(uint256).max);
    }

    // ONLY MODULAR_SWAP_ROUTER_ROLE FUNCTION //

    function liquidate(uint256 amountIn) external onlyRole(MODULAR_SWAP_ROUTER_ROLE) returns(uint amountOut) {

        IERC20(tokenInContract).transferFrom(marginAccount, address(this), amountIn);

        ISwapRouter.ExactInputParams memory params = _preparationInputParams(amountIn);

        amountOut = swapRouter.exactInput(params);
        IERC20(tokenOutContract).transfer(marginAccount, amountOut);
    }

    function swapInput(uint amountIn, uint amountOutMinimum) external onlyRole(MODULAR_SWAP_ROUTER_ROLE) returns(uint amountOut) {
        IERC20(tokenInContract).transferFrom(marginAccount, address(this), amountIn);

        ISwapRouter.ExactInputParams memory params = _preparationInputParams(amountIn);
        params.amountOutMinimum = amountOutMinimum;

        amountOut = swapRouter.exactInput(params);

        IERC20(tokenOutContract).transfer(marginAccount, amountOut);
    }

    function swapOutput(uint amountOut) external onlyRole(MODULAR_SWAP_ROUTER_ROLE) returns(uint amountIn) {
        ISwapRouter.ExactOutputParams memory params = _preparationOutputParams(amountOut);

        amountIn = getOutputPositionValue(amountOut);
        IERC20(tokenInContract).transferFrom(marginAccount, address(this), amountIn);

        swapRouter.exactOutput(params);

        IERC20(tokenOutContract).transfer(marginAccount, amountOut);
    }

    // PRIVATE FUNCTION //

    /**
     * @notice Prepares the parameters for an exact input swap.
     * @param amount The amount of input tokens.
     * @return params The prepared ExactInputParams struct.
     */
    function _preparationInputParams(uint256 amount) private view returns(ISwapRouter.ExactInputParams memory params) {
        params = ISwapRouter.ExactInputParams({
            path: uniswapPath,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: amount,
            amountOutMinimum: 0
        });
    }

    /**
     * @notice Prepares the parameters for an exact output swap.
     * @param amount The amount of output tokens.
     * @return params The prepared ExactOutputParams struct.
     */
    function _preparationOutputParams(uint256 amount) private view returns(ISwapRouter.ExactOutputParams memory params) {
        params = ISwapRouter.ExactOutputParams({
            path: uniswapPath,
            recipient: address(this),
            deadline: block.timestamp,
            amountOut: amount,
            amountInMaximum: 0
        });
    }
}
