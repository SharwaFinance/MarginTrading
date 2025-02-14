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
  MarginAccountManager
} from "../typechain-types";
import { Signer, parseUnits, ZeroAddress } from "ethers";
import { MockERC20 } from "../typechain-types";
import { calculateMarginRatio } from "../utils/calculation";
import { time } from "@nomicfoundation/hardhat-network-helpers";


describe("general_use_cases.ts", function () {
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
  let User_3: Signer
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
    User_3 = signers[3]
    User_4 = signers[4]

    const weth_amount_to_swap_router = parseUnits("1000", await WETH.decimals())
    const wbtc_amount_to_swap_router = parseUnits("100", await WBTC.decimals())
    const usdc_amount_to_swap_router = parseUnits("100000", await USDC.decimals())
    const usdc_e_amount_to_swap_router = parseUnits("100000", await USDC_e.decimals())

    SwapRouterMock = await ethers.getContract("SwapRouter")
    await WETH.connect(deployer).mintTo(await SwapRouterMock.getAddress(), weth_amount_to_swap_router)
    await WBTC.connect(deployer).mintTo(await SwapRouterMock.getAddress(), wbtc_amount_to_swap_router)
    await USDC.connect(deployer).mintTo(await SwapRouterMock.getAddress(), usdc_amount_to_swap_router)
    await USDC_e.connect(deployer).mintTo(await SwapRouterMock.getAddress(), usdc_e_amount_to_swap_router)

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
    
    MockHegicStrategy = await ethers.getContract("MockHegicStrategy")
    MockOperationalTreasury = await ethers.getContract("OperationalTreasury")
    HegicPositionsManager = await ethers.getContract("HegicPositionsManager")

    const optionProfit = parseUnits("100", await USDC_e.decimals())
    const oneWeek = 60*60*24*7
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

  })

  it("Should correctly create margin account", async () => {
    const margin_account_0 = 0
    const margin_account_1 = 1

    await margin_account_manager.connect(User_1).createMarginAccount()
    expect(await margin_account_manager.ownerOf(margin_account_0)).to.eq(await User_1.getAddress());

    await margin_account_manager.connect(User_1).createMarginAccount()
    expect(await margin_account_manager.ownerOf(margin_account_1)).to.eq(await User_1.getAddress());
  });

  it("Should correctly grant approve and renounce approve when token is transferred to another address", async () => {
    const margin_account_0 = 0
    await margin_account_manager.connect(User_1).createMarginAccount()
    expect(await margin_account_manager.isApprovedOrOwner(User_1, margin_account_0)).to.be.eq(true)
    expect(await margin_account_manager.isApprovedOrOwner(User_2, margin_account_0)).to.be.eq(false)

    await margin_account_manager.connect(User_1).approve(User_2, margin_account_0)
    expect(await margin_account_manager.isApprovedOrOwner(User_1, margin_account_0)).to.be.eq(true)
    expect(await margin_account_manager.isApprovedOrOwner(User_2, margin_account_0)).to.be.eq(true)
    
    await margin_account_manager.connect(User_1).transferFrom(User_1, User_2, margin_account_0)
    expect(await margin_account_manager.isApprovedOrOwner(User_1, margin_account_0)).to.be.eq(false)
    expect(await margin_account_manager.isApprovedOrOwner(User_2, margin_account_0)).to.be.eq(true)    
  })

  it("Should correctly provide and withdraw collateral (ERC-20)", async () => {
    await margin_account_manager.connect(User_1).createMarginAccount()
  
    const usdc_amount = parseUnits("500", await USDC.decimals())
    const margin_account_0 = 0

    await expect(
      margin_trading.connect(User_1).provideERC20(margin_account_0, await USDC.getAddress(), usdc_amount)
    ).to.changeTokenBalances(
      USDC, 
      [await User_1.getAddress(), await margin_account.getAddress()], 
      [-usdc_amount, usdc_amount]
    );

    expect(await margin_account.getErc20ByContract(0, await USDC.getAddress())).to.be.eq(usdc_amount);
    await expect(
      margin_trading.connect(User_1).withdrawERC20(0, await USDC.getAddress(), usdc_amount)
    ).to.changeTokenBalances(
      USDC, 
      [await User_1.getAddress(), await margin_account.getAddress()], 
      [usdc_amount, -usdc_amount]
    );
  });
  
  it("Should revert provide of ERC-20 when the user isn't the owner of the margin account", async () => {
    await margin_account_manager.connect(User_1).createMarginAccount()
    const margin_account_0 = 0

    const usdc_amount = parseUnits("500", await USDC.decimals())
    await expect(
      margin_trading.connect(User_2).provideERC20(margin_account_0, await USDC.getAddress(), usdc_amount)
    ).to.be.revertedWith("You are not the owner of the token") 
  })

  it("Should accept provide when User_2 has approve to the margin account of User_1", async () => {
    await margin_account_manager.connect(User_1).createMarginAccount()
    const margin_account_0 = 0
    const usdc_amount = parseUnits("500", await USDC.decimals())
    await USDC.connect(User_2).mint(usdc_amount)
    
    await margin_account_manager.connect(User_1).approve(User_2, margin_account_0)
    await USDC.connect(User_2).approve(await margin_account.getAddress(), usdc_amount)
    
    await expect(
      margin_trading.connect(User_2).provideERC20(margin_account_0, await USDC.getAddress(), usdc_amount)
    ).to.changeTokenBalances(
      USDC, 
      [await User_2, await margin_account.getAddress()], 
      [-usdc_amount, usdc_amount]
    );
  })

  it("Should revert provide when ERC-20 token is not supported", async () => {
    await margin_account_manager.connect(User_1).createMarginAccount()
    const margin_account_0 = 0
    const USDC_e_amount = parseUnits("500", await USDC_e.decimals())
    
    await expect(
      margin_trading.connect(User_1).provideERC20(margin_account_0, USDC_e, USDC_e_amount)
    ).to.be.revertedWith("Token you are attempting to deposit is not available for deposit") 
  })

  it("Should revert provide when amount is wrong", async () => {
    const margin_account_0 = 0
    await margin_account_manager.connect(User_1).createMarginAccount()
    await USDC.connect(User_1).approve(margin_account, ethers.MaxUint256)
    const usdc_amount = parseUnits("500000000000000000", await USDC.decimals())
    await expect(
      margin_trading.connect(User_1).provideERC20(margin_account_0, await USDC.getAddress(), usdc_amount)
    ).to.be.revertedWith("ERC20: transfer amount exceeds balance")

  })

  it("Should revert provide of ERC-721 when the user isn't the owner of the margin account", async () => {
    await margin_account_manager.connect(User_1).createMarginAccount()
    const margin_account_0 = 0
    const optionId = 0

    await expect(
      margin_trading.connect(User_2).provideERC721(margin_account_0, await HegicPositionsManager, optionId)
    ).to.be.revertedWith("You are not the owner of the token") 
  })

  it("Should revert provide of ERC-721 token when it's not supported", async () => {
    await margin_account_manager.connect(User_1).createMarginAccount()
    const margin_account_0 = 0
    const optionId = 0
    await expect(
      margin_trading.connect(User_1).provideERC721(margin_account_0, await margin_account_manager, optionId)
    ).to.be.revertedWith("token id is not valid") 
  })

  it("Should revert provide if the option id is wrong", async () => {
    await margin_account_manager.connect(User_1).createMarginAccount()
    const margin_account_0 = 0
    const optionId = 1
    await expect(
      margin_trading.connect(User_1).provideERC721(margin_account_0, await HegicPositionsManager, optionId)
    ).to.be.revertedWith("token id is not valid") 
  })

  it.skip("Should correctly split USDC between the liquidity pool and the insurance pool", async () => {
    const margin_account_id_0 = 0

    const amount_to_withdraw = parseUnits("500", 6)
    await margin_trading.connect(User_1).withdrawERC20(margin_account_id_0, USDC, amount_to_withdraw)

    const usdc_interest_rate = parseUnits("10",2)
    const weth_interest_rate = parseUnits("10",2)
    const wbtc_interest_rate = parseUnits("10",2)

    await usdc_liquidity_pool.connect(deployer).setInterestRate(usdc_interest_rate)
    await weth_liquidity_pool.connect(deployer).setInterestRate(weth_interest_rate)
    await wbtc_liquidity_pool.connect(deployer).setInterestRate(wbtc_interest_rate)

    const usdc_to_liquidity_pool = parseUnits("100000", 6)
    const weth_to_liquidity_pool = parseUnits("10", 18)
    const wbtc_to_liquidity_pool = parseUnits("1", 8)

    await USDC.connect(deployer).mint(usdc_to_liquidity_pool)
    await WETH.connect(deployer).mint(weth_to_liquidity_pool)
    await WBTC.connect(deployer).mint(wbtc_to_liquidity_pool)

    await USDC.connect(deployer).approve(usdc_liquidity_pool, ethers.MaxUint256)
    await WETH.connect(deployer).approve(weth_liquidity_pool, ethers.MaxUint256)
    await WBTC.connect(deployer).approve(wbtc_liquidity_pool, ethers.MaxUint256)

    const usdc_insurance_rate_multiplier = parseUnits("20",3)
    const weth_insurance_rate_multiplier = parseUnits("20",3)
    const wbtc_insurance_rate_multiplier = parseUnits("20",3)

    await usdc_liquidity_pool.connect(deployer).setInsuranceRateMultiplier(usdc_insurance_rate_multiplier)
    await usdc_liquidity_pool.connect(deployer).setInsuranceRateMultiplier(weth_insurance_rate_multiplier)
    await usdc_liquidity_pool.connect(deployer).setInsuranceRateMultiplier(wbtc_insurance_rate_multiplier)

    await usdc_liquidity_pool.connect(deployer).provide(usdc_to_liquidity_pool)
    await weth_liquidity_pool.connect(deployer).provide(weth_to_liquidity_pool)
    await wbtc_liquidity_pool.connect(deployer).provide(wbtc_to_liquidity_pool)

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

    const wethDebt = await weth_liquidity_pool.getDebtWithAccruedInterest(margin_account_id_0)
    const wbtcDebt = await wbtc_liquidity_pool.getDebtWithAccruedInterest(margin_account_id_0)
    const usdcDebt = await usdc_liquidity_pool.getDebtWithAccruedInterest(margin_account_id_0)
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

  });
})


