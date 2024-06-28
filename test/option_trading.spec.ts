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
  MockAggregatorV3
} from "../typechain-types";
import { Signer, parseUnits, ZeroAddress, BigNumberish } from "ethers";
import { MockERC20 } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { calculateMarginRatio } from "../utils/calculation";



describe("option_trading_spec.ts", function () {
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
  let MockAggregatorV3_WETH_USDC: MockAggregatorV3
  let MockAggregatorV3_WBTC_USDC: MockAggregatorV3
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
    MockAggregatorV3_WETH_USDC = await ethers.getContract("MockAggregatorV3_WETH_USDC")
    MockAggregatorV3_WBTC_USDC = await ethers.getContract("MockAggregatorV3_WBTC_USDC")
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

    await weth_liquidity_pool.provide(weth_amount_to_liquidity_pool)
    await wbtc_liquidity_pool.provide(wbtc_amount_to_liquidity_pool)
    await usdc_liquidity_pool.provide(usdc_amount_to_liquidity_pool)
    
    // prepare Hegic Options //

    MockHegicStrategy = await ethers.getContract("MockHegicStrategy")
    MockOperationalTreasury = await ethers.getContract("OperationalTreasury")
    HegicPositionsManager = await ethers.getContract("HegicPositionsManager")

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

    const option_0_payoff = parseUnits("0", await USDC_e.decimals())
    const oneWeek = 60 * 60 * 24 * 7
    const option_id = 0
    const optionActive = 0
    const optionExpired = 1

    await HegicPositionsManager.connect(User_1).mint(await User_1)
    await MockHegicStrategy.setPayOffAmount(option_id, option_0_payoff)
    await MockOperationalTreasury.setLockedLiquidity(option_id, oneWeek, 1)

    await HegicPositionsManager.connect(User_1).approve(await margin_account, option_id)

  })

  it("Should correctly account payoff from the option position", async () => {
    const margin_account_id_0 = 0
    const option_id = 0

    const usdc_borrow_amount = parseUnits("5000", await USDC.decimals()) 
    const amountOutMinimum = 0
    await margin_trading.connect(User_1).borrow(margin_account_id_0, USDC, usdc_borrow_amount)
    await margin_trading.connect(User_1).swap(margin_account_id_0, await USDC, await WETH, usdc_borrow_amount, amountOutMinimum)

    const expected_account_value_1 = parseUnits("5500", 6)

    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id)
    await expect(await margin_trading.calculateMarginAccountValue.staticCall(margin_account_id_0)).to.be.eq(expected_account_value_1)

    const option_0_payoff_1 = parseUnits("500", await USDC_e.decimals())
    await MockHegicStrategy.setPayOffAmount(option_id, option_0_payoff_1)

    const expected_account_value_2 = parseUnits("6000", 6)
    await expect(await margin_trading.calculateMarginAccountValue.staticCall(margin_account_id_0)).to.be.eq(expected_account_value_2)

  });

  it("Should correctly account payoff when the option position is expired", async () => {
    const margin_account_id_0 = 0
    const option_id = 0

    const usdc_borrow_amount = parseUnits("5000", await USDC.decimals()) 
    const amountOutMinimum = 0
    await margin_trading.connect(User_1).borrow(margin_account_id_0, USDC, usdc_borrow_amount)
    await margin_trading.connect(User_1).swap(margin_account_id_0, await USDC, await WETH, usdc_borrow_amount, amountOutMinimum)

    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager, option_id)

    const option_0_payoff_1 = parseUnits("500", await USDC_e.decimals())
    await MockHegicStrategy.setPayOffAmount(option_id, option_0_payoff_1)

    const expected_account_value_1 = parseUnits("6000", 6)
    await expect(await margin_trading.calculateMarginAccountValue.staticCall(margin_account_id_0)).to.be.eq(expected_account_value_1)

    await time.increase(604801) //1 week and 1 second
    const expected_account_value_2 = parseUnits("5500", 6)
    await expect(await margin_trading.calculateMarginAccountValue.staticCall(margin_account_id_0)).to.be.eq(expected_account_value_2)

  });


  it("Should revert withdrawERC721 when margin ratio falls below the yellow coeff", async () => {
    const margin_account_id_0 = 0
    const option_id_0 = 0
    const option_id_1 = 1

    const optionProfit = 0
    const active_state = 0
    const oneWeek = 60 * 60 * 24 * 7

    await HegicPositionsManager.mint(await User_1) //mint option 0
    await HegicPositionsManager.mint(await User_1) //mint option 1

    await MockHegicStrategy.setPayOffAmount(option_id_0, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_1, optionProfit)
    await MockOperationalTreasury.setLockedLiquidity(option_id_0, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_1, oneWeek, 1)

    const usdc_borrow_amount = parseUnits("5000", await USDC.decimals()) 
    const collateral = parseUnits("500", await USDC.decimals())
    const amountOutMinimum = 0

    const weth_price_0 = parseUnits("4000", await USDC.decimals())
    await QuoterMock.setSwapPrice(await WETH.getAddress(), await USDC.getAddress(), weth_price_0)
    await MockAggregatorV3_WETH_USDC.setAnswer(parseUnits("4000", 8))

    await margin_trading.connect(User_1).borrow(margin_account_id_0, await USDC.getAddress(), usdc_borrow_amount )
    await margin_trading.connect(User_1).swap(margin_account_id_0, await USDC.getAddress(), await WETH.getAddress(), usdc_borrow_amount + collateral, amountOutMinimum)

    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_0)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_1)

    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_0)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_1)

    const new_payoffs_for_all = parseUnits("250", await USDC_e.decimals())
    await MockHegicStrategy.setPayOffAmount(option_id_0, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_1, new_payoffs_for_all)

    const weth_price_1 = parseUnits("3500", await USDC.decimals())
    await QuoterMock.setSwapPrice(await WETH.getAddress(), await USDC.getAddress(), weth_price_1)
    await MockAggregatorV3_WETH_USDC.setAnswer(parseUnits("3500", 8))

    await expect(margin_trading.connect(User_1).withdrawERC721(margin_account_id_0, HegicPositionsManager ,option_id_1)).to.be.revertedWith("portfolioRatio is too low")

  });

})


