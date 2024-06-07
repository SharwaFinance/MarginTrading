import { ethers, deployments } from "hardhat";
import { 
    MarginTrading, 
    MarginAccount,
    MarginAccountManager, 
    MockOperationalTreasury, 
    MockHegicStrategy, 
    MockPositionsManager,
    LiquidityPool,
    SwapRouterMock,
    ModularSwapRouter,
    UniswapModule,
    QuoterMock
  } from "../typechain-types";
import { MockERC20 } from "../typechain-types";
import { Signer, parseUnits, ZeroAddress, keccak256, toUtf8Bytes } from "ethers";

export interface PreparationResult {
    WETH_LiquidityPool: LiquidityPool;
    WBTC_LiquidityPool: LiquidityPool;
    USDC_LiquidityPool: LiquidityPool;
    MarginTrading: MarginTrading;
    MarginAccount: MarginAccount;
    MockOperationalTreasury: MockOperationalTreasury;
    MockHegicStrategy: MockHegicStrategy;
    HegicPositionsManager: MockPositionsManager;
    MarginAccountManager: MarginAccountManager;
    SwapRouterMock: SwapRouterMock;
    ModularSwapRouter: ModularSwapRouter;
    UniswapModule_WETH_USDC: UniswapModule;
    QuoterMock: QuoterMock;
    USDC: MockERC20;
    USDCe: MockERC20;
    WETH: MockERC20;
    WBTC: MockERC20;
    signers: Signer[];
    deployer: Signer;
}

export async function preparationContracts():  Promise<PreparationResult> {
    let WETH_LiquidityPool: LiquidityPool
    let WBTC_LiquidityPool: LiquidityPool
    let USDC_LiquidityPool: LiquidityPool
    let MarginTrading: MarginTrading
    let MarginAccount: MarginAccount
    let MockOperationalTreasury: MockOperationalTreasury
    let MockHegicStrategy: MockHegicStrategy
    let HegicPositionsManager: MockPositionsManager
    let MarginAccountManager: MarginAccountManager
    let SwapRouterMock: SwapRouterMock
    let ModularSwapRouter: ModularSwapRouter
    let UniswapModule_WETH_USDC: UniswapModule 
    let QuoterMock: QuoterMock
    let USDC: MockERC20
    let USDCe: MockERC20
    let WETH: MockERC20
    let WBTC: MockERC20
    let signers: Signer[]
    let deployer: Signer

    await deployments.fixture(["hegic_module"])
    MarginTrading = await ethers.getContract("MarginTrading")
    MarginAccount = await ethers.getContract("MarginAccount")
    MarginAccountManager = await ethers.getContract("MarginAccountManager")
    ModularSwapRouter = await ethers.getContract("ModularSwapRouter")
    UniswapModule_WETH_USDC = await ethers.getContract("WETH_USDC_UniswapModule")
    QuoterMock = await ethers.getContract("Quoter")
    USDC = await ethers.getContract("USDC")
    USDCe = await ethers.getContract("USDCe")
    WETH = await ethers.getContract("WETH")
    WBTC = await ethers.getContract("WBTC")
    signers = await ethers.getSigners()
    deployer = signers[0]

    // mint tokens //
    let WETHmintAmount = parseUnits("100", await WETH.decimals())
    await WETH.connect(deployer).mint(WETHmintAmount)
    await WETH.connect(deployer).approve(await MarginAccount.getAddress(), WETHmintAmount)

    let WBTCmintAmount = parseUnits("10", await WBTC.decimals())
    await WBTC.connect(deployer).mint(WBTCmintAmount)
    await WBTC.connect(deployer).approve(await MarginAccount.getAddress(), WBTCmintAmount)

    let USDCmintAmount = parseUnits("1000", await USDC.decimals())
    await USDC.connect(deployer).mint(USDCmintAmount)
    await USDC.connect(deployer).approve(await MarginAccount.getAddress(), USDCmintAmount)

    // preparation insurancePool // 

    WETHmintAmount = WETHmintAmount*BigInt(10)
    WBTCmintAmount = WBTCmintAmount*BigInt(10)
    USDCmintAmount = USDCmintAmount*BigInt(10)

    await WETH.connect(signers[5]).mint(WETHmintAmount)
    await WETH.connect(signers[5]).approve(await MarginAccount.getAddress(), WETHmintAmount)

    await WBTC.connect(signers[5]).mint(WBTCmintAmount)
    await WBTC.connect(signers[5]).approve(await MarginAccount.getAddress(), WBTCmintAmount)

    await USDC.connect(signers[5]).mint(USDCmintAmount)
    await USDC.connect(signers[5]).approve(await MarginAccount.getAddress(), USDCmintAmount)

    // preparation SwapRouter // 

    SwapRouterMock = await ethers.getContract("SwapRouter")
    await WETH.connect(deployer).mintTo(await SwapRouterMock.getAddress(), WETHmintAmount*BigInt(10))
    await WBTC.connect(deployer).mintTo(await SwapRouterMock.getAddress(), WBTCmintAmount*BigInt(10))
    await USDC.connect(deployer).mintTo(await SwapRouterMock.getAddress(), USDCmintAmount*BigInt(10))
    await USDCe.connect(deployer).mintTo(await SwapRouterMock.getAddress(), USDCmintAmount*BigInt(10))

    // preparation pools //

    WETH_LiquidityPool = await ethers.getContract("WETH_LiquidityPool")
    WBTC_LiquidityPool = await ethers.getContract("WBTC_LiquidityPool")
    USDC_LiquidityPool = await ethers.getContract("USDC_LiquidityPool")

    await WETH.connect(deployer).mint(WETHmintAmount)
    await WBTC.connect(deployer).mint(WBTCmintAmount)
    await USDC.connect(deployer).mint(USDCmintAmount)

    await WETH.connect(deployer).approve(await WETH_LiquidityPool.getAddress(), WETHmintAmount)
    await WBTC.connect(deployer).approve(await WBTC_LiquidityPool.getAddress(), WBTCmintAmount)
    await USDC.connect(deployer).approve(await USDC_LiquidityPool.getAddress(), USDCmintAmount)

    await WETH_LiquidityPool.connect(deployer).provide(WETHmintAmount)
    await WBTC_LiquidityPool.connect(deployer).provide(WBTCmintAmount)
    await USDC_LiquidityPool.connect(deployer).provide(USDCmintAmount)
    
    // preparation hegic //

    MockHegicStrategy = await ethers.getContract("MockHegicStrategy")
    MockOperationalTreasury = await ethers.getContract("OperationalTreasury")
    HegicPositionsManager = await ethers.getContract("HegicPositionsManager")

    const optionProfit = parseUnits("100", await USDCe.decimals())
    const oneWeek = 60*60*24*7
    const optionId = 0

    await HegicPositionsManager.connect(deployer).mint(await deployer.getAddress())
    await MockHegicStrategy.setPayOffAmount(optionId, optionProfit)
    await MockOperationalTreasury.setLockedLiquidity(optionId, oneWeek, 1)

    // user approve
    await HegicPositionsManager.connect(deployer).approve(await MarginAccount.getAddress(), optionId)


    return {
        WETH_LiquidityPool: WETH_LiquidityPool,
        WBTC_LiquidityPool: WBTC_LiquidityPool,
        USDC_LiquidityPool: USDC_LiquidityPool,
        MarginTrading: MarginTrading,
        MarginAccount: MarginAccount,
        MockOperationalTreasury: MockOperationalTreasury,
        MockHegicStrategy: MockHegicStrategy,
        HegicPositionsManager: HegicPositionsManager,
        MarginAccountManager: MarginAccountManager,
        SwapRouterMock: SwapRouterMock,
        ModularSwapRouter: ModularSwapRouter,
        UniswapModule_WETH_USDC: UniswapModule_WETH_USDC,
        QuoterMock: QuoterMock,
        USDC: USDC,
        USDCe: USDCe,
        WETH: WETH,
        WBTC: WBTC,
        signers: signers,
        deployer: deployer,
    };
}