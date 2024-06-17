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



describe("liquidation.spec.ts", function () {
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

    const weth_amount_to_liquidity_pool = parseUnits("1.5", await WETH.decimals())
    const wbtc_amount_to_liquidity_pool = parseUnits("1.5", await WBTC.decimals())
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

    const optionProfit = parseUnits("0", await USDC_e.decimals())
    const oneWeek = 60 * 60 * 24 * 7
    const optionId = 0

    await HegicPositionsManager.mint(await User_1)
    await MockHegicStrategy.setPayOffAmount(optionId, optionProfit)
    await MockOperationalTreasury.setLockedLiquidity(optionId, oneWeek, 1)

    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), optionId)
    await USDC_e.connect(deployer).mintTo(await MockOperationalTreasury.getAddress(), usdc_e_amount_to_swap_router)

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

  it("Should correctly liquidate an margin account", async () => {
    const margin_account_id_0 = 0

    const weth_price_1 = parseUnits("4000", await USDC.decimals())
    await QuoterMock.setSwapPrice(await WETH.getAddress(), await USDC.getAddress(), weth_price_1)

    const usdc_borrow_amount = parseUnits("5000", await USDC.decimals()) 
    await margin_trading.connect(User_1).borrow(margin_account_id_0, USDC, usdc_borrow_amount)

    const account_value_1 = await margin_trading.calculateMarginAccountValue.staticCall(margin_account_id_0)
    const usdcDebt_1 = await usdc_liquidity_pool.getDebtWithAccruedInterest(margin_account_id_0)
    const usdcPrice = parseUnits("1",0)
    const wethDebt = parseUnits("0", 18)
    const wbtcDebt = parseUnits("0", 8)
    const wbtcPrice = parseUnits("40000", await USDC.decimals())

    const expectedMarginRatio_1 = calculateMarginRatio(
      account_value_1,
      wethDebt,
      weth_price_1,
      wbtcDebt,
      wbtcPrice,
      usdcDebt_1,
      usdcPrice 
    );

    expect(await margin_trading.getMarginAccountRatio.staticCall(margin_account_id_0)).to.be.eq(expectedMarginRatio_1)

    const expected_weth_balance = parseUnits("1.25", await WETH.decimals())
    await margin_trading.connect(User_1).swap(margin_account_id_0, await USDC, await WETH, usdc_borrow_amount, 0)
    await expect(await WETH.balanceOf(await margin_account)).to.be.eq(expected_weth_balance)

    const usdcDebt_2 = await usdc_liquidity_pool.getDebtWithAccruedInterest(margin_account_id_0)
    const account_value_2 = await margin_trading.calculateMarginAccountValue.staticCall(margin_account_id_0)

    const expectedMarginRatio_2 = calculateMarginRatio(
      account_value_2,
      wethDebt,
      weth_price_1,
      wbtcDebt,
      wbtcPrice,
      usdcDebt_2,
      usdcPrice 
    );

    expect(await margin_trading.getMarginAccountRatio.staticCall(margin_account_id_0)).to.be.eq(expectedMarginRatio_2)

    const weth_price_3 = parseUnits("3750", await USDC.decimals())
    await QuoterMock.setSwapPrice(await WETH.getAddress(), await USDC.getAddress(), weth_price_3)

    const account_value_3 = await margin_trading.calculateMarginAccountValue.staticCall(margin_account_id_0)
    const usdcDebt_3 = await usdc_liquidity_pool.getDebtWithAccruedInterest(margin_account_id_0)

    const expectedMarginRatio_3 = calculateMarginRatio(
      account_value_3,
      wethDebt,
      weth_price_3,
      wbtcDebt,
      wbtcPrice,
      usdcDebt_3,
      usdcPrice 
    );

    expect(await margin_trading.getMarginAccountRatio.staticCall(margin_account_id_0)).to.be.eq(expectedMarginRatio_3)

    const expected_amount_to_liquidity_pool = parseUnits("5000.000022",6)
    const expected_amount_to_insurance_pool = 1

    await expect(
      margin_trading.connect(User_4).liquidate(margin_account_id_0)
    ).to.changeTokenBalances(
      USDC, 
      [usdc_liquidity_pool, InsurancePool], 
      [expected_amount_to_liquidity_pool, expected_amount_to_insurance_pool]
    );
  });

  it("Should correctly split USDC between the liquidity pool and the insurance pool when the margin account is liquidated", async () => {
    const margin_account_id_0 = 0

    const amount_to_withdraw = parseUnits("500", 6)
    await margin_trading.connect(User_1).withdrawERC20(margin_account_id_0, USDC, amount_to_withdraw)

    const max_borrow_multiplier = parseUnits("1", 4)
    await usdc_liquidity_pool.setMaximumBorrowMultiplier(max_borrow_multiplier)
    await weth_liquidity_pool.setMaximumBorrowMultiplier(max_borrow_multiplier)
    await wbtc_liquidity_pool.setMaximumBorrowMultiplier(max_borrow_multiplier)

    const usdc_interest_rate = parseUnits("10",2)
    const weth_interest_rate = parseUnits("10",2)
    const wbtc_interest_rate = parseUnits("10",2)

    await usdc_liquidity_pool.connect(deployer).setInterestRate(usdc_interest_rate)
    await weth_liquidity_pool.connect(deployer).setInterestRate(weth_interest_rate)
    await wbtc_liquidity_pool.connect(deployer).setInterestRate(wbtc_interest_rate)

    const usdc_insurance_rate_multiplier = parseUnits("0",3)
    const weth_insurance_rate_multiplier = parseUnits("0",3)
    const wbtc_insurance_rate_multiplier = parseUnits("0",3)

    await usdc_liquidity_pool.connect(deployer).setInsuranceRateMultiplier(usdc_insurance_rate_multiplier)
    await weth_liquidity_pool.connect(deployer).setInsuranceRateMultiplier(weth_insurance_rate_multiplier)
    await wbtc_liquidity_pool.connect(deployer).setInsuranceRateMultiplier(wbtc_insurance_rate_multiplier)

    const weth_price_1 = parseUnits("4000", await USDC.decimals())
    await QuoterMock.setSwapPrice(await WETH.getAddress(), await USDC.getAddress(), weth_price_1)

    const collateral = parseUnits("60000", 6)
    await USDC.connect(User_1).mint(collateral)
    await USDC.connect(User_1).approve(margin_account, ethers.MaxUint256)
    await margin_trading.connect(User_1).provideERC20(margin_account_id_0, USDC, collateral)

    const usdc_borrow_amount = parseUnits("100000", await USDC.decimals()) 
    await margin_trading.connect(User_1).borrow(margin_account_id_0, USDC, usdc_borrow_amount)

    const weth_borrow_amount = parseUnits("1.5", await WETH.decimals())
    await margin_trading.connect(User_1).borrow(margin_account_id_0, WETH, weth_borrow_amount)

    const wbtc_borrow_amount = parseUnits("1.5", await WBTC.decimals())
    await margin_trading.connect(User_1).borrow(margin_account_id_0, WBTC, wbtc_borrow_amount)

    await margin_trading.connect(User_1).swap(margin_account_id_0, await USDC, await WETH, usdc_borrow_amount, 0)
    await time.increase(31536000) //increase time to 1yr

    const weth_price_2 = parseUnits("2700", await USDC.decimals())
    await QuoterMock.setSwapPrice(await WETH.getAddress(), await USDC.getAddress(), weth_price_2)

    const wbtc_price_1 = parseUnits("60000", await USDC.decimals())
    await QuoterMock.setSwapPrice(await WBTC.getAddress(), await USDC.getAddress(), wbtc_price_1)

    const accountValue = await margin_trading.calculateMarginAccountValue.staticCall(margin_account_id_0)

    const wethDebt = await weth_liquidity_pool.getDebtWithAccruedInterestOnTime(margin_account_id_0, await time.latest() + 1)
    const wbtcDebt = await wbtc_liquidity_pool.getDebtWithAccruedInterestOnTime(margin_account_id_0, await time.latest() + 1)
    const usdcDebt = await usdc_liquidity_pool.getDebtWithAccruedInterestOnTime(margin_account_id_0, await time.latest() + 1)
    const usdcPrice = parseUnits("1", 0)

    const expected_margin_ratio = calculateMarginRatio(
      accountValue,
      wethDebt,
      weth_price_2,
      wbtcDebt,
      wbtc_price_1,
      usdcDebt,
      usdcPrice
    )

    const margin_ratio_from_contract = await margin_trading.getMarginAccountRatio.staticCall(margin_account_id_0)
    await expect(margin_ratio_from_contract).to.be.eq(expected_margin_ratio)

    const expected_amount_total_debt_in_usdc = parseUnits("213455.002315", await USDC.decimals())
    const expected_amount_to_usdc_liquidity_pool = parseUnits("110000.001994", await USDC.decimals())
    const expected_amount_to_weth_liquidity_pool = parseUnits("1.650000024933694467", await WETH.decimals())
    const expected_amount_to_wbtc_liquidity_pool = parseUnits("1.65000001", await WBTC.decimals())
    const expected_amount_to_insurance_pool = parseUnits("0")

    await expect(await margin_trading.calculateDebtWithAccruedInterest.staticCall(margin_account_id_0)).to.be.eq(expected_amount_total_debt_in_usdc)

    await margin_trading.connect(User_4).liquidate(margin_account_id_0)

    const account_debt = await margin_trading.calculateDebtWithAccruedInterest.staticCall(margin_account_id_0)
    const expected_account_debt = parseUnits("0", 6)

    const account_value = await margin_trading.calculateMarginAccountValue.staticCall(margin_account_id_0)
    const expected_account_value = parseUnits("1824.997282", 6)

    await expect (await USDC.balanceOf(usdc_liquidity_pool)).to.be.eq(expected_amount_to_usdc_liquidity_pool)
    await expect (await WETH.balanceOf(weth_liquidity_pool)).to.be.eq(expected_amount_to_weth_liquidity_pool)
    await expect (await WBTC.balanceOf(wbtc_liquidity_pool)).to.be.eq(expected_amount_to_wbtc_liquidity_pool)

    await expect (await USDC.balanceOf(InsurancePool)).to.be.eq(expected_amount_to_insurance_pool)
    await expect (await USDC.balanceOf(InsurancePool)).to.be.eq(expected_amount_to_insurance_pool)
    await expect (await USDC.balanceOf(InsurancePool)).to.be.eq(expected_amount_to_insurance_pool)

    await expect(account_debt).to.be.eq(expected_account_debt)
    await expect(account_value).to.be.eq(expected_account_value)

  });

  it("Should correctly liquidate multiple option positions", async () => {
    const margin_account_id_0 = 0
    const option_id_0 = 0
    const option_id_1 = 1
    const option_id_2 = 2
    const option_id_3 = 3
    const option_id_4 = 4
    const option_id_5 = 5
    const option_id_6 = 6
    const option_id_7 = 7
    const option_id_8 = 8
    const option_id_9 = 9
    const option_id_10 = 10
    const option_id_11 = 11
    const option_id_12 = 12
    const option_id_13 = 13
    const option_id_14 = 14
    const option_id_15 = 15
    const option_id_16 = 16
    const option_id_17 = 17
    const option_id_18 = 18
    const option_id_19 = 19
    const option_id_20 = 20

    const optionProfit = 0
    const active_state = 0
    const oneWeek = 60 * 60 * 24 * 7

    await HegicPositionsManager.mint(await User_1) //mint option 0
    await HegicPositionsManager.mint(await User_1) //mint option 1
    await HegicPositionsManager.mint(await User_1) //mint option 2
    await HegicPositionsManager.mint(await User_1) //mint option 3
    await HegicPositionsManager.mint(await User_1) //mint option 4
    await HegicPositionsManager.mint(await User_1) //mint option 5
    await HegicPositionsManager.mint(await User_1) //mint option 6
    await HegicPositionsManager.mint(await User_1) //mint option 7
    await HegicPositionsManager.mint(await User_1) //mint option 8
    await HegicPositionsManager.mint(await User_1) //mint option 9
    await HegicPositionsManager.mint(await User_1) //mint option 10
    await HegicPositionsManager.mint(await User_1) //mint option 11
    await HegicPositionsManager.mint(await User_1) //mint option 12
    await HegicPositionsManager.mint(await User_1) //mint option 13
    await HegicPositionsManager.mint(await User_1) //mint option 14
    await HegicPositionsManager.mint(await User_1) //mint option 15
    await HegicPositionsManager.mint(await User_1) //mint option 16
    await HegicPositionsManager.mint(await User_1) //mint option 17
    await HegicPositionsManager.mint(await User_1) //mint option 18
    await HegicPositionsManager.mint(await User_1) //mint option 19
    await HegicPositionsManager.mint(await User_1) //mint option 20

    await MockHegicStrategy.setPayOffAmount(option_id_0, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_1, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_2, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_3, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_4, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_5, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_6, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_7, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_8, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_9, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_10, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_11, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_12, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_13, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_14, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_15, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_16, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_17, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_18, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_19, optionProfit)
    await MockHegicStrategy.setPayOffAmount(option_id_20, optionProfit)

    await MockOperationalTreasury.setLockedLiquidity(option_id_0, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_1, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_2, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_3, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_4, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_5, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_6, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_7, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_8, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_9, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_10, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_11, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_12, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_13, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_14, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_15, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_16, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_17, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_18, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_19, oneWeek, 1)
    await MockOperationalTreasury.setLockedLiquidity(option_id_20, oneWeek, 1)

    const usdc_borrow_amount = parseUnits("5000", await USDC.decimals()) 
    const amountOutMinimum = 0
    await margin_trading.connect(User_1).borrow(margin_account_id_0, await USDC.getAddress(), usdc_borrow_amount)
    await margin_trading.connect(User_1).swap(margin_account_id_0, await USDC.getAddress(), await WETH.getAddress(), usdc_borrow_amount, amountOutMinimum)

    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_0)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_1)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_2)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_3)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_4)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_5)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_6)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_7)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_8)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_9)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_10)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_11)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_12)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_13)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_14)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_15)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_16)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_17)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_18)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_19)
    await HegicPositionsManager.connect(User_1).approve(await margin_account.getAddress(), option_id_20)

    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_0)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_1)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_2)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_3)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_4)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_5)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_6)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_7)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_8)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_9)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_10)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_11)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_12)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_13)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_14)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_15)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_16)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_17)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_18)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_19)
    await margin_trading.connect(User_1).provideERC721(margin_account_id_0, await HegicPositionsManager.getAddress(), option_id_20)

    const expected_account_value_1 = parseUnits("5500", 6)
    expect(await margin_trading.calculateMarginAccountValue.staticCall(margin_account_id_0)).to.be.eq(expected_account_value_1)

    const new_payoffs_for_all = parseUnits("1", await USDC_e.decimals())
    await MockHegicStrategy.setPayOffAmount(option_id_0, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_1, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_2, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_3, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_4, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_5, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_6, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_7, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_8, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_9, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_10, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_11, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_12, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_13, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_14, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_15, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_16, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_17, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_18, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_19, new_payoffs_for_all)
    await MockHegicStrategy.setPayOffAmount(option_id_20, new_payoffs_for_all)

    const account_value = await margin_trading.calculateMarginAccountValue.staticCall(margin_account_id_0)
    const expected_account_value_0 = parseUnits("5521", await USDC.decimals())
    await expect(account_value).to.be.eq(expected_account_value_0)

    const weth_price_1 = parseUnits("3700", await USDC.decimals())
    await QuoterMock.setSwapPrice(await WETH.getAddress(), await USDC.getAddress(), weth_price_1)

    await margin_trading.connect(User_1).liquidate(margin_account_id_0)
    
    const expected_amount_to_usdc_liquidity_pool = parseUnits("100000.000485", await USDC.decimals())
    await expect(await USDC.balanceOf(usdc_liquidity_pool)).to.be.eq(expected_amount_to_usdc_liquidity_pool)

    const expected_margin_ratio = 0
    await expect(await margin_trading.getMarginAccountRatio.staticCall(margin_account_id_0)).to.be.eq(expected_margin_ratio)

    const account_value_before_withdraw = await margin_trading.calculateMarginAccountValue.staticCall(margin_account_id_0)

    await expect(
      margin_trading.connect(User_1).withdrawERC20(margin_account_id_0, USDC, account_value_before_withdraw)
    ).to.changeTokenBalances(
      USDC, 
      [User_1, margin_account], 
      [account_value_before_withdraw, -account_value_before_withdraw]
    );

  });


})


