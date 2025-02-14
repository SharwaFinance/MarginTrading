import { expect } from "chai";
import { ethers, deployments } from "hardhat";
import { 
  MarginTrading, 
  MarginAccount,
  MockOperationalTreasury, 
  MockHegicStrategy, 
  MockPositionsManager,
  LiquidityPool,
  SwapRouterMock,
  ModularSwapRouter,
  QuoterMock,
  MarginAccountManager,
} from "../typechain-types";
import { Signer, parseUnits, ZeroAddress, BigNumberish } from "ethers";
import { MockERC20 } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { calculateMarginRatio } from "../utils/calculation";



describe("uniswap_trading.ts", function () {
  let weth_liquidity_pool: LiquidityPool
  let wbtc_liquidity_pool: LiquidityPool
  let usdc_liquidity_pool: LiquidityPool
  let margin_trading: MarginTrading
  let margin_account: MarginAccount
  let MockOperationalTreasury: MockOperationalTreasury
  let MockHegicStrategy: MockHegicStrategy
  let HegicPositionsManager: MockPositionsManager
  let margin_account_manager: MarginAccountManager
  let SwapRouterMock: SwapRouterMock
  let ModularSwapRouter: ModularSwapRouter
  let QuoterMock: QuoterMock
  let USDC: MockERC20
  let USDC_e: MockERC20
  let WETH: MockERC20
  let WBTC: MockERC20
  let signers: Signer[]
  let deployer: Signer
  let User_1: Signer
  let User_2: Signer
  let InsurancePool: Signer
  let User_4: Signer

  beforeEach(async () => {
    await deployments.fixture(["hegic_module"])
    margin_trading = await ethers.getContract("MarginTrading")
    margin_account = await ethers.getContract("MarginAccount")
    margin_account_manager = await ethers.getContract("MarginAccountManager")
    ModularSwapRouter = await ethers.getContract("ModularSwapRouter")
    QuoterMock = await ethers.getContract("Quoter")
    USDC = await ethers.getContract("USDC")
    USDC_e = await ethers.getContract("USDCe")
    WETH = await ethers.getContract("WETH")
    WBTC = await ethers.getContract("WBTC")
    signers = await ethers.getSigners()
    deployer = signers[0]
    User_1 = signers[1]
    User_2 = signers[2]
    InsurancePool = signers[5]
    User_4 = signers[4]


    // prepare SwapRouter // 

    const weth_amount_to_swap_router = parseUnits("1000", await WETH.decimals())
    const wbtc_amount_to_swap_router = parseUnits("100", await WBTC.decimals())
    const usdc_amount_to_swap_router = parseUnits("100000", await USDC.decimals())
    const usdc_e_amount_to_swap_router = parseUnits("100000", await USDC_e.decimals())

    SwapRouterMock = await ethers.getContract("SwapRouter")
    await WETH.connect(deployer).mintTo(await SwapRouterMock.getAddress(), weth_amount_to_swap_router)
    await WBTC.connect(deployer).mintTo(await SwapRouterMock.getAddress(), wbtc_amount_to_swap_router)
    await USDC.connect(deployer).mintTo(await SwapRouterMock.getAddress(), usdc_amount_to_swap_router)
    await USDC_e.connect(deployer).mintTo(await SwapRouterMock.getAddress(), usdc_e_amount_to_swap_router)

    // prepare liquidity pools //

    weth_liquidity_pool = await ethers.getContract("WETH_LiquidityPool")
    wbtc_liquidity_pool = await ethers.getContract("WBTC_LiquidityPool")
    usdc_liquidity_pool = await ethers.getContract("USDC_LiquidityPool")

    const weth_amount_to_liquidity_pool = parseUnits("100", await WETH.decimals())
    const wbtc_amount_to_liquidity_pool = parseUnits("10", await WBTC.decimals())
    const usdc_amount_to_liquidity_pool = parseUnits("100000", await USDC.decimals())

    await WETH.connect(deployer).mint(weth_amount_to_liquidity_pool)
    await WBTC.connect(deployer).mint(wbtc_amount_to_liquidity_pool)
    await USDC.connect(deployer).mint(usdc_amount_to_liquidity_pool)

    await WETH.connect(deployer).approve(await weth_liquidity_pool.getAddress(), weth_amount_to_liquidity_pool)
    await WBTC.connect(deployer).approve(await wbtc_liquidity_pool.getAddress(), wbtc_amount_to_liquidity_pool)
    await USDC.connect(deployer).approve(await usdc_liquidity_pool.getAddress(), usdc_amount_to_liquidity_pool)

    await weth_liquidity_pool.setMaximumPoolCapacity(weth_amount_to_liquidity_pool*10n)
    await wbtc_liquidity_pool.setMaximumPoolCapacity(wbtc_amount_to_liquidity_pool*10n)
    await usdc_liquidity_pool.setMaximumPoolCapacity(usdc_amount_to_liquidity_pool*10n)
    await weth_liquidity_pool.provide(weth_amount_to_liquidity_pool)
    await wbtc_liquidity_pool.provide(wbtc_amount_to_liquidity_pool)
    await usdc_liquidity_pool.provide(usdc_amount_to_liquidity_pool)
    
    // prepare Hegic Options //

    MockHegicStrategy = await ethers.getContract("MockHegicStrategy")
    MockOperationalTreasury = await ethers.getContract("OperationalTreasury")
    HegicPositionsManager = await ethers.getContract("HegicPositionsManager")

    const optionProfit = parseUnits("100", await USDC_e.decimals())
    const oneWeek = 60 * 60 * 24 * 7
    const optionId = 0

    await HegicPositionsManager.mint(await User_1)
    await MockHegicStrategy.setPayOffAmount(optionId, optionProfit)
    await MockOperationalTreasury.setLockedLiquidity(optionId, oneWeek, 1)

    await HegicPositionsManager.connect(User_1).approve(await margin_account, optionId)

    const weth_amount_to_user_1 = parseUnits("5", await WETH.decimals())
    const wbtc_amount_to_user_1 = parseUnits("0.5", await WBTC.decimals())
    const usdc_amount_to_user_1 = parseUnits("1000", await USDC.decimals())

    await WETH.connect(User_1).mint(weth_amount_to_user_1)
    await WETH.connect(User_1).approve(await margin_account.getAddress(), weth_amount_to_user_1)

    await WBTC.connect(User_1).mint(wbtc_amount_to_user_1)
    await WBTC.connect(User_1).approve(await margin_account.getAddress(), wbtc_amount_to_user_1)

    await USDC.connect(User_1).mint(usdc_amount_to_user_1)
    await USDC.connect(User_1).approve(await margin_account.getAddress(), usdc_amount_to_user_1)

    await margin_account_manager.connect(User_1).createMarginAccount()

    const margin_account_id_0 = 0
    const usdc_amount = parseUnits("500", await USDC.decimals())
    await margin_trading.connect(User_1).provideERC20(margin_account_id_0, USDC, usdc_amount)

  })

  it("Should correctly swap tokens and calculate margin ratio", async () => {
    const margin_account_id_0 = 0

    const usdc_borrow_amount = parseUnits("5000", await USDC.decimals()) 
    await margin_trading.connect(User_1).borrow(margin_account_id_0, USDC, usdc_borrow_amount)

    const weth_price_1 = parseUnits("4000", await USDC.decimals())
    await QuoterMock.setSwapPrice(await WETH.getAddress(), await USDC.getAddress(), weth_price_1)

    const usdcPrice = parseUnits("1",0)
    const usdcDebt_1 = await usdc_liquidity_pool.getDebtWithAccruedInterest(margin_account_id_0)
    const wethDebt = parseUnits("0", 18)
    const wbtcDebt = parseUnits("0", 8)
    const wbtcPrice = parseUnits("40000", await USDC.decimals())

    const accountValue_1 = await margin_trading.calculateMarginAccountValue.staticCall(margin_account_id_0)

    const expectedMarginRatio_1 = calculateMarginRatio(
      accountValue_1,
      wethDebt, 
      weth_price_1,
      wbtcDebt,
      wbtcPrice,
      usdcDebt_1, 
      usdcPrice
    );

    expect(await margin_trading.getMarginAccountRatio.staticCall(margin_account_id_0)).to.be.eq(expectedMarginRatio_1)

    await QuoterMock.setSwapPrice(await WETH.getAddress(), await USDC.getAddress(), weth_price_1)
    await margin_trading.connect(User_1).swap(margin_account_id_0, await USDC, await WETH, usdc_borrow_amount, 0)

    const expected_weth_balance = parseUnits("1.25", await WETH.decimals())
    await expect(await WETH.balanceOf(await margin_account)).to.be.eq(expected_weth_balance)

    const usdcDebt_2 = await usdc_liquidity_pool.getDebtWithAccruedInterest(margin_account_id_0)
    const accountValue_2 = await margin_trading.calculateMarginAccountValue.staticCall(margin_account_id_0)

    const expectedMarginRatio_2 = calculateMarginRatio(
      accountValue_2,
      wethDebt, 
      weth_price_1,
      wbtcDebt,
      wbtcPrice,
      usdcDebt_2, 
      usdcPrice
    );

    expect(await margin_trading.getMarginAccountRatio.staticCall(margin_account_id_0)).to.be.eq(expectedMarginRatio_2)

  });


  it("Should swap token from collateral with active borrow", async () => {
    const margin_account_id_0 = 0

    const weth_price_1 = parseUnits("4000", await USDC.decimals())
    await QuoterMock.setSwapPrice(await WETH.getAddress(), await USDC.getAddress(), weth_price_1)

    const usdc_borrow_amount = parseUnits("5000", await USDC.decimals()) 
    await margin_trading.connect(User_1).borrow(margin_account_id_0, USDC, usdc_borrow_amount)
    await margin_trading.connect(User_1).swap(margin_account_id_0, await USDC, await WETH, usdc_borrow_amount, 0)

    const collateral = parseUnits("500", await USDC.decimals())
    await margin_trading.connect(User_1).swap(margin_account_id_0, await USDC, await WETH, collateral, 0)

    const expected_balance = parseUnits("1.375", await WETH.decimals())

    const weth_account_balance = await WETH.balanceOf(margin_account.getAddress())
    const usdc_account_balance = await USDC.balanceOf(margin_account.getAddress())

    await expect(weth_account_balance).to.be.eq(expected_balance)
    await expect(usdc_account_balance).to.be.eq(0)

  });
})


