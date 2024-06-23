// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "forge-std/Test.sol";

import {MarginTrading} from "contracts/MarginTrading.sol";
import {LiquidityPool} from "contracts/LiquidityPool.sol";
import {MarginAccount} from "contracts/MarginAccount.sol";
import {MarginAccountManager} from "contracts/MarginAccountManager.sol";
import {ModularSwapRouter} from "contracts/modularSwapRouter/ModularSwapRouter.sol";
import {HegicModule} from "contracts/modularSwapRouter/hegic/HegicModule.sol";
import {UniswapModule} from "contracts/modularSwapRouter/uniswap/UniswapModule.sol";

import {IModularSwapRouter} from "contracts/interfaces/modularSwapRouter/IModularSwapRouter.sol";
import {IMarginTrading} from "contracts/interfaces/IMarginTrading.sol";
import {IPositionManagerERC20} from "contracts/interfaces/modularSwapRouter/IPositionManagerERC20.sol";
import {IPositionManagerERC721} from "contracts/interfaces/modularSwapRouter/IPositionManagerERC721.sol";
import {IQuoter} from "contracts/interfaces/modularSwapRouter/uniswap/IQuoter.sol";
import {IHegicStrategy} from "contracts/interfaces/modularSwapRouter/hegic/IHegicStrategy.sol";
import {IOperationalTreasury} from "contracts/interfaces/modularSwapRouter/hegic/IOperationalTreasury.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

import {MockERC20} from "contracts/mock/MockERC20.sol";
import {QuoterMock} from "contracts/mock/QuoterMock.sol";
import {SwapRouterMock} from "contracts/mock/SwapRouterMock.sol";
import {MockHegicStrategy} from "contracts/mock/MockHegicStrategy.sol";
import {MockOperationalTreasury} from "contracts/mock/MockOperationTreasury.sol";
import {MockPositionsManager} from "contracts/mock/MockPositionsManager.sol";

abstract contract Base is Test {
	address alice;
	address bob;
	address charlie;
	address[] ACTORS;
	address insurancePool;

	MockERC20 USDC;
	MockERC20 USDCe;
	MockERC20 WETH;
	MockERC20 WBTC;
	QuoterMock quoter;
	SwapRouterMock swapRouter;
	MockHegicStrategy hegicStrategy;
	MockOperationalTreasury operationTreasury;
	MockPositionsManager hegicPositionsManager;
	MarginAccountManager marginAccountManager;
	MarginTrading marginTrading;
	MarginAccount marginAccount;
	LiquidityPool liquidityPoolWETH;
	LiquidityPool liquidityPoolUSDC;
	LiquidityPool liquidityPoolWBTC;
	ModularSwapRouter modularSwapRouter;
	UniswapModule uniswapModuleWethToUsdc;
	UniswapModule uniswapModuleUsdcToWeth;
	UniswapModule uniswapModuleWbtcToUsdc;
	UniswapModule uniswapModuleUsdcToWbtc;
	UniswapModule uniswapModuleUsdceToUsdc;
	HegicModule hegicModule;

	mapping(address => uint256) public marginAccountID;
	mapping(address => uint256) public optionID;

    function setup() internal {
		// Preparations
		alice = makeAddr("Alice");
		bob = makeAddr("Bob");
		charlie = makeAddr("Charlie");
		ACTORS = [alice, bob, charlie];

		USDC = new MockERC20("USDC", "USDC", 6);
		USDCe = new MockERC20("USDCe", "USDCe", 6);
		WETH = new MockERC20("WETH", "WETH", 18);
		WBTC = new MockERC20("WBTC", "WBTC", 8);

		quoter = new QuoterMock();
		quoter.setSwapPrice(address(WETH), address(USDC), 4_000e6);
		quoter.setSwapPrice(address(USDC), address(WETH), 0.00025e18);
		quoter.setSwapPrice(address(WBTC), address(USDC), 80_000e6);
		quoter.setSwapPrice(address(USDC), address(WBTC), 0.0000125e8);
		quoter.setSwapPrice(address(USDCe), address(USDC), 1e6);

		swapRouter = new SwapRouterMock(quoter);
		WETH.mintTo(address(swapRouter), 10_000e18);
		WBTC.mintTo(address(swapRouter), 1_000e8);
		USDC.mintTo(address(swapRouter), 100_000e6);
		USDCe.mintTo(address(swapRouter), 100_000e6);

		hegicStrategy = new MockHegicStrategy();
		operationTreasury = new MockOperationalTreasury(IHegicStrategy(hegicStrategy), address(USDCe));
		USDCe.mintTo(address(operationTreasury), 100_000e6);
		hegicPositionsManager = new MockPositionsManager();

		// Margin account manager
		marginAccountManager = new MarginAccountManager();

		// Margin account
		insurancePool = address(0x123456);
		marginAccount = new MarginAccount(insurancePool);
		marginAccount.grantRole(marginAccount.MANAGER_ROLE(), address(this));
		WETH.mintTo(insurancePool, 10_000e18);
		WBTC.mintTo(insurancePool, 1_000e8);
		USDC.mintTo(insurancePool, 100_000e6);
		vm.startPrank(insurancePool);
		WETH.approve(address(marginAccount), type(uint256).max);
		WBTC.approve(address(marginAccount), type(uint256).max);
		USDC.approve(address(marginAccount), type(uint256).max);
		vm.stopPrank();

		address[] memory availableErc20 = new address[](3);
		availableErc20[0] = address(USDC);
		availableErc20[1] = address(WETH);
		availableErc20[2] = address(WBTC);
		marginAccount.setAvailableErc20(availableErc20);
		marginAccount.setIsAvailableErc20(address(USDC), true);
		marginAccount.setIsAvailableErc20(address(WETH), true);
		marginAccount.setIsAvailableErc20(address(WBTC), true);

		address[] memory availableErc721 = new address[](1);
		availableErc721[0] = address(hegicPositionsManager);
		marginAccount.setAvailableErc721(availableErc721);
		marginAccount.setIsAvailableErc721(address(hegicPositionsManager), true);

		// Margin trading
		marginTrading = new MarginTrading(address(marginAccountManager), address(USDC), address(marginAccount));
		marginTrading.grantRole(marginTrading.MANAGER_ROLE(), address(this));
		marginAccount.grantRole(marginAccount.MARGIN_TRADING_ROLE(), address(marginTrading));

		// Liquidity pools
		liquidityPoolWETH = new LiquidityPool(insurancePool, address(marginAccount), USDC, WETH, "SF-LP-WETH", "SF-LP-WETH", 5_000e18);
		liquidityPoolWETH.grantRole(liquidityPoolWETH.MANAGER_ROLE(), address(this));
		liquidityPoolWBTC = new LiquidityPool(insurancePool, address(marginAccount), USDC, WBTC, "SF-LP-WBTC", "SF-LP-WBTC", 1_000e8);
		liquidityPoolWBTC.grantRole(liquidityPoolWBTC.MANAGER_ROLE(), address(this));
		liquidityPoolUSDC = new LiquidityPool(insurancePool, address(marginAccount), USDC, USDC, "SF-LP-USDC", "SF-LP-USDC", 500_000e6);
		liquidityPoolUSDC.grantRole(liquidityPoolUSDC.MANAGER_ROLE(), address(this));
		marginAccount.setAvailableTokenToLiquidityPool(availableErc20);
		marginAccount.setTokenToLiquidityPool(address(WETH), address(liquidityPoolWETH));
		marginAccount.approveERC20(address(WETH), address(liquidityPoolWETH), type(uint256).max);
		marginAccount.setTokenToLiquidityPool(address(WBTC), address(liquidityPoolWBTC));
		marginAccount.approveERC20(address(WBTC), address(liquidityPoolWBTC), type(uint256).max);
		marginAccount.setTokenToLiquidityPool(address(USDC), address(liquidityPoolUSDC));
		marginAccount.approveERC20(address(USDC), address(liquidityPoolUSDC), type(uint256).max);

		// Modular swap router
		modularSwapRouter = new ModularSwapRouter(IMarginTrading(marginTrading));
		modularSwapRouter.grantRole(modularSwapRouter.MANAGER_ROLE(), address(this));
		modularSwapRouter.grantRole(modularSwapRouter.MARGIN_ACCOUNT_ROLE(), address(marginAccount));
		marginAccount.setModularSwapRouter(IModularSwapRouter(modularSwapRouter));
		marginTrading.setModularSwapRouter(IModularSwapRouter(modularSwapRouter));

		// Uniswap module
		uniswapModuleWethToUsdc = _deployUniswapModule(address(WETH), address(USDC));
		uniswapModuleUsdcToWeth = _deployUniswapModule(address(USDC), address(WETH));
		uniswapModuleWbtcToUsdc = _deployUniswapModule(address(WBTC), address(USDC));
		uniswapModuleUsdcToWbtc = _deployUniswapModule(address(USDC), address(WBTC));
		uniswapModuleUsdceToUsdc = _deployUniswapModule(address(USDCe), address(USDC));

		// Hegic module
		hegicModule = new HegicModule(IERC20(USDCe), IERC721(hegicPositionsManager), IOperationalTreasury(operationTreasury), IPositionManagerERC20(uniswapModuleUsdceToUsdc), address(marginAccount));
		hegicModule.grantRole(hegicModule.MODULAR_SWAP_ROUTER_ROLE(), address(modularSwapRouter));
		modularSwapRouter.setTokenInToTokenOutToExchange(address(hegicPositionsManager), address(USDC), address(hegicModule));
		uniswapModuleUsdceToUsdc.grantRole(uniswapModuleUsdceToUsdc.MODULAR_SWAP_ROUTER_ROLE(), address(hegicModule));
    }

	function _deployUniswapModule(address tokenIn, address tokenOut) internal returns (UniswapModule uniswapModule) {
		bytes memory path = abi.encodePacked(tokenIn, uint24(3000), tokenOut);
		uniswapModule = new UniswapModule(address(marginAccount), tokenIn, tokenOut, ISwapRouter(address(swapRouter)), IQuoter(address(quoter)), path);
		uniswapModule.grantRole(uniswapModule.MODULAR_SWAP_ROUTER_ROLE(), address(modularSwapRouter));
		uniswapModule.grantRole(uniswapModule.MANAGER_ROLE(), address(this));
		uniswapModule.allApprove();
		modularSwapRouter.setTokenInToTokenOutToExchange(tokenIn, tokenOut, address(uniswapModule));
		marginAccount.approveERC20(tokenIn, address(uniswapModule), type(uint256).max);
	}

    function setupActors() internal {
		for (uint256 i; i < ACTORS.length; i++) {
			address actor = ACTORS[i];

			WETH.mintTo(actor, 1_000e18);
			WBTC.mintTo(actor, 100e8);
			USDC.mintTo(actor, 1_000_000e6);
			hegicPositionsManager.mint(actor);
			optionID[actor] = hegicPositionsManager.nextTokenId() - 1;
			operationTreasury.setLockedLiquidity(optionID[actor], block.timestamp + 1 weeks, IOperationalTreasury.LockedLiquidityState.Locked);
			hegicStrategy.setPayOffAmount(optionID[actor], 1_000e6);

			vm.startPrank(actor);
			WETH.approve(address(marginAccount), type(uint256).max);
			WBTC.approve(address(marginAccount), type(uint256).max);
			USDC.approve(address(marginAccount), type(uint256).max);
			WETH.approve(address(liquidityPoolWETH), type(uint256).max);
			WBTC.approve(address(liquidityPoolWBTC), type(uint256).max);
			USDC.approve(address(liquidityPoolUSDC), type(uint256).max);
			hegicPositionsManager.setApprovalForAll(address(marginAccount), true);
			uint256 _marginAccountID = marginAccountManager.createMarginAccount();
			vm.stopPrank();

			marginAccountID[actor] = _marginAccountID;
		}
	}

	function provideInitialLiquidity() internal {
		uint256 initialWETHLiquidity = 1_000e18;
		uint256 initialWBTCliquidity = 100e8;
		uint256 initialUSDCLiquidity = 50_000e6;

		WETH.mint(initialWETHLiquidity);
		WBTC.mint(initialWBTCliquidity);
		USDC.mint(initialUSDCLiquidity);

		WETH.approve(address(liquidityPoolWETH), type(uint256).max);
		WBTC.approve(address(liquidityPoolWBTC), type(uint256).max);
		USDC.approve(address(liquidityPoolUSDC), type(uint256).max);

		liquidityPoolWETH.provide(initialWETHLiquidity);
		liquidityPoolWBTC.provide(initialWBTCliquidity);
		liquidityPoolUSDC.provide(initialUSDCLiquidity);
	}
}