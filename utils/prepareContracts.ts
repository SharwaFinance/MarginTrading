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
    UniswapModuleWithChainlink,
    QuoterMock,
    MockAggregatorV3,
    StopMarketOrder
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
    UniswapModule_WETH_USDC: UniswapModuleWithChainlink;
    QuoterMock: QuoterMock;
    AggregatorV3_WETH_USDC: MockAggregatorV3;
    AggregatorV3_WBTC_USDC: MockAggregatorV3;
    USDC: MockERC20;
    USDCe: MockERC20;
    WETH: MockERC20;
    WBTC: MockERC20;
    signers: Signer[];
    deployer: Signer;
    insurance: Signer;
    StopMarketOrder: StopMarketOrder;
}

export async function prepareContracts():  Promise<PreparationResult> {
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
    let UniswapModule_WETH_USDC: UniswapModuleWithChainlink 
    let QuoterMock: QuoterMock
    let AggregatorV3_WETH_USDC: MockAggregatorV3;
    let AggregatorV3_WBTC_USDC: MockAggregatorV3;
    let USDC: MockERC20
    let USDCe: MockERC20
    let WETH: MockERC20
    let WBTC: MockERC20
    let signers: Signer[]
    let deployer: Signer
    let insurance: Signer
    let StopMarketOrder: StopMarketOrder

    await deployments.fixture(["stop_market_order"])
    MarginTrading = await ethers.getContract("MarginTrading")
    MarginAccount = await ethers.getContract("MarginAccount")
    MarginAccountManager = await ethers.getContract("MarginAccountManager")
    ModularSwapRouter = await ethers.getContract("ModularSwapRouter")
    UniswapModule_WETH_USDC = await ethers.getContract("WETH_USDC_UniswapModule")
    QuoterMock = await ethers.getContract("Quoter")
    AggregatorV3_WETH_USDC = await ethers.getContract("AggregatorV3_WETH_USDC")
    AggregatorV3_WBTC_USDC = await ethers.getContract("AggregatorV3_WBTC_USDC")
    StopMarketOrder = await ethers.getContract("StopMarketOrder")
    USDC = await ethers.getContract("USDC")
    USDCe = await ethers.getContract("USDCe")
    WETH = await ethers.getContract("WETH")
    WBTC = await ethers.getContract("WBTC")
    signers = await ethers.getSigners()
    deployer = signers[0]
    insurance = signers[5]

    await MarginAccount.setLiquidatorFee(0.05*1e5)

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

    // prepare insurancePool // 

    WETHmintAmount = WETHmintAmount*BigInt(10)
    WBTCmintAmount = WBTCmintAmount*BigInt(10)
    USDCmintAmount = USDCmintAmount*BigInt(10)

    await WETH.connect(insurance).mint(WETHmintAmount)
    await WETH.connect(insurance).approve(await MarginAccount.getAddress(), WETHmintAmount)

    await WBTC.connect(insurance).mint(WBTCmintAmount)
    await WBTC.connect(insurance).approve(await MarginAccount.getAddress(), WBTCmintAmount)

    await USDC.connect(insurance).mint(USDCmintAmount)
    await USDC.connect(insurance).approve(await MarginAccount.getAddress(), USDCmintAmount)

    // prepare SwapRouter // 

    SwapRouterMock = await ethers.getContract("SwapRouter")
    await WETH.connect(deployer).mintTo(await SwapRouterMock.getAddress(), WETHmintAmount*BigInt(100000000000000000000))
    await WBTC.connect(deployer).mintTo(await SwapRouterMock.getAddress(), WBTCmintAmount*BigInt(100000000000000000000))
    await USDC.connect(deployer).mintTo(await SwapRouterMock.getAddress(), USDCmintAmount*BigInt(100000000000000000000))
    await USDCe.connect(deployer).mintTo(await SwapRouterMock.getAddress(), USDCmintAmount*BigInt(100000000000000000000))

    // prepare pools //

    WETH_LiquidityPool = await ethers.getContract("WETH_LiquidityPool")
    WBTC_LiquidityPool = await ethers.getContract("WBTC_LiquidityPool")
    USDC_LiquidityPool = await ethers.getContract("USDC_LiquidityPool")

    await WETH_LiquidityPool.setMaximumPoolCapacity(WETHmintAmount*BigInt(10))
    await WBTC_LiquidityPool.setMaximumPoolCapacity(WBTCmintAmount*BigInt(10))
    await USDC_LiquidityPool.setMaximumPoolCapacity(USDCmintAmount*BigInt(10))

    await WETH.connect(deployer).mint(WETHmintAmount)
    await WBTC.connect(deployer).mint(WBTCmintAmount)
    await USDC.connect(deployer).mint(USDCmintAmount)

    await WETH.connect(deployer).approve(await WETH_LiquidityPool.getAddress(), WETHmintAmount)
    await WBTC.connect(deployer).approve(await WBTC_LiquidityPool.getAddress(), WBTCmintAmount)
    await USDC.connect(deployer).approve(await USDC_LiquidityPool.getAddress(), USDCmintAmount)

    await WETH_LiquidityPool.connect(deployer).provide(WETHmintAmount)
    await WBTC_LiquidityPool.connect(deployer).provide(WBTCmintAmount)
    await USDC_LiquidityPool.connect(deployer).provide(USDCmintAmount)
    
    // prepare hegic //

    MockHegicStrategy = await ethers.getContract("MockHegicStrategy")
    MockOperationalTreasury = await ethers.getContract("OperationalTreasury")
    HegicPositionsManager = await ethers.getContract("HegicPositionsManager")

    await USDCe.connect(deployer).mintTo(await MockOperationalTreasury.getAddress(), WETHmintAmount*BigInt(10))

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
        AggregatorV3_WETH_USDC: AggregatorV3_WETH_USDC,
        AggregatorV3_WBTC_USDC: AggregatorV3_WBTC_USDC,
        USDC: USDC,
        USDCe: USDCe,
        WETH: WETH,
        WBTC: WBTC,
        signers: signers,
        deployer: deployer,
        insurance: insurance,
        StopMarketOrder: StopMarketOrder
    };
}