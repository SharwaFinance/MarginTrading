import { expect } from "chai";
import { PreparationResult, prepareContracts } from "../utils/prepareContracts"
import { formatUnits, parseUnits } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import calculateUserSupplied from "../utils/front_utils/calculateUserSupplied";
import calculateTotalSupplied from "../utils/front_utils/calculateTotalSupplied";
import calculateSupplyAPY from "../utils/front_utils/calculateSupplyAPY";
import calculateUtilizationRate from "../utils/front_utils/calculateUtilizationRate";
import calculateAvailableToWithdraw from "../utils/front_utils/calculateAvailableToWithdraw";
import calculateChangeMarginRatioAfterBorrowSwap from "../utils/front_utils/calculateChangeMarginRatioAfterBorrowSwap";
import calculateInterestServiceFee from "../utils/front_utils/calculateInterestServiceFee";
import calculateMaxAmountToSupply from "../utils/front_utils/calculateMaxAmountToSupply";
import calculateChangeMarginRatioAfterRepay from "../utils/front_utils/calculateChangeMarginRatioAfterRepay";
import calculateWithdrawAmount from "../utils/front_utils/calculateWithdrawAmount";
import calculateChangeMarginRatioAfterProvide from "../utils/front_utils/calculateChangeMarginRatioAfterProvide";
import calculateChangeMarginRatioAfterWithdraw from "../utils/front_utils/calculateChangeMarginRatioAfterWithdraw";

describe("front_utils.spec.ts", function () {
    let c: PreparationResult

    beforeEach(async () => {
        c = await prepareContracts()
    })

    describe("FrontUtils", async () => {
        it("calculateUserSupplied", async () => {
            let USDCmintAmount = parseUnits("10010", await c.USDC.decimals())
            let WETHmintAmount = parseUnits("1000.01", await c.WETH.decimals())
            let WBTCmintAmount = parseUnits("100.001", await c.WBTC.decimals())

            expect(await calculateUserSupplied(c.USDC_LiquidityPool, c.deployer))
                .to.be.eq(USDCmintAmount)
            expect(await calculateUserSupplied(c.WETH_LiquidityPool, c.deployer))
                .to.be.eq(WETHmintAmount)
            expect(await calculateUserSupplied(c.WBTC_LiquidityPool, c.deployer))
                .to.be.eq(WBTCmintAmount)
        })

        it("calculateTotalSupplied", async () => {
            let USDCmintAmount = parseUnits("10010", await c.USDC.decimals())
            let WETHmintAmount = parseUnits("1000.01", await c.WETH.decimals())
            let WBTCmintAmount = parseUnits("100.001", await c.WBTC.decimals())

            expect(await calculateTotalSupplied(c.USDC_LiquidityPool))
                .to.be.eq(USDCmintAmount)
            expect(await calculateTotalSupplied(c.WETH_LiquidityPool))
                .to.be.eq(WETHmintAmount)
            expect(await calculateTotalSupplied(c.WBTC_LiquidityPool))
                .to.be.eq(WBTCmintAmount)
        })

        it("calculateSupplyAPY", async () => {
            expect(await calculateSupplyAPY(c.USDC_LiquidityPool)).to.be.eq(8800n)
            expect(await calculateSupplyAPY(c.WETH_LiquidityPool)).to.be.eq(3760n)
            expect(await calculateSupplyAPY(c.WBTC_LiquidityPool)).to.be.eq(400n)
        })

        it("calculateUtilizationRate", async () => {
            await c.MarginAccountManager.connect(c.deployer).createMarginAccount()

            const USDCprovideAmount = parseUnits("100", await c.USDC.decimals())
            const USDCloanAmount = USDCprovideAmount * BigInt(2)

            const WETHprovideAmount = parseUnits("0.1", await c.WETH.decimals())
            const WETHloanAmount = WETHprovideAmount * BigInt(2)

            const WBTCprovideAmount = parseUnits("0.01", await c.WBTC.decimals())
            const WBTCloanAmount = WBTCprovideAmount * BigInt(2)

            const marginAccountID = 0
            await c.MarginTrading.connect(c.deployer).provideERC20(marginAccountID, await c.USDC.getAddress(), USDCprovideAmount)
            await c.MarginTrading.connect(c.deployer).provideERC20(marginAccountID, await c.WETH.getAddress(), WETHprovideAmount)
            await c.MarginTrading.connect(c.deployer).provideERC20(marginAccountID, await c.WBTC.getAddress(), WBTCprovideAmount)

            await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.USDC.getAddress(), USDCloanAmount)
            await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.WETH.getAddress(), WETHloanAmount)
            await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.WBTC.getAddress(), WBTCloanAmount)

            expect(await calculateUtilizationRate(c.USDC_LiquidityPool, c.USDC)).to.be.eq(parseUnits("0.01998", 5))
            expect(await calculateUtilizationRate(c.WETH_LiquidityPool, c.WETH)).to.be.eq(parseUnits("0.00019", 5))
            expect(await calculateUtilizationRate(c.WBTC_LiquidityPool, c.WBTC)).to.be.eq(parseUnits("0.00019", 5))
        })

        it("calculateAvailableToWithdraw", async () => {
            expect(
                await calculateUserSupplied(c.USDC_LiquidityPool, c.deployer)
            ).to.be.eq(
                await calculateAvailableToWithdraw(c.USDC_LiquidityPool, c.deployer, c.USDC)
            )
        })

        it("calculateChangeMarginRatioAfterBorrowSwap borrow USDC", async () => {
            await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
            const USDCprovideAmount = parseUnits("400", await c.USDC.decimals())
            const marginAccountID = BigInt(0)
            await c.MarginTrading.connect(c.deployer).provideERC20(marginAccountID, await c.USDC.getAddress(), USDCprovideAmount)
            expect(await calculateChangeMarginRatioAfterBorrowSwap(
                marginAccountID, 
                c.USDC, 
                c.USDC, 
                USDCprovideAmount, 
                c.MarginTrading,
                c.ModularSwapRouter
            )).to.be.eq(
                200000n
            )
        })

        it("calculateChangeMarginRatioAfterBorrowSwap borrow WETH", async () => {
            await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
            const WETHprovideAmount = parseUnits("0.1", await c.WETH.decimals())
            const marginAccountID = BigInt(0)
            await c.MarginTrading.connect(c.deployer).provideERC20(marginAccountID, await c.WETH.getAddress(), WETHprovideAmount)
            expect(await calculateChangeMarginRatioAfterBorrowSwap(
                marginAccountID, 
                c.USDC, 
                c.WETH, 
                WETHprovideAmount, 
                c.MarginTrading,
                c.ModularSwapRouter
            )).to.be.eq(
                200000n
            )
        })

        it("calculateChangeMarginRatioAfterBorrowSwap borrow WBTC", async () => {
            await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
            const WBTCprovideAmount = parseUnits("0.01", await c.WBTC.decimals())
            const marginAccountID = BigInt(0)
            await c.MarginTrading.connect(c.deployer).provideERC20(marginAccountID, await c.WBTC.getAddress(), WBTCprovideAmount)
            expect(await calculateChangeMarginRatioAfterBorrowSwap(
                marginAccountID, 
                c.USDC, 
                c.WBTC, 
                WBTCprovideAmount, 
                c.MarginTrading,
                c.ModularSwapRouter
            )).to.be.eq(
                200000n
            )
        })

        it("calculateInterestServiceFee", async () => {
            await c.MarginAccountManager.connect(c.deployer).createMarginAccount()

            const USDCprovideAmount = parseUnits("100", await c.USDC.decimals())
            const WETHprovideAmount = parseUnits("0.025", await c.WETH.decimals())
            const WBTCprovideAmount = parseUnits("0.0025", await c.WBTC.decimals())

            const marginAccountID = BigInt(0)
            await c.MarginTrading.connect(c.deployer).provideERC20(marginAccountID, await c.USDC.getAddress(), USDCprovideAmount)
            await c.MarginTrading.connect(c.deployer).provideERC20(marginAccountID, await c.WETH.getAddress(), WETHprovideAmount)
            await c.MarginTrading.connect(c.deployer).provideERC20(marginAccountID, await c.WBTC.getAddress(), WBTCprovideAmount)

            await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.USDC.getAddress(), USDCprovideAmount)
            await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.WETH.getAddress(), WETHprovideAmount)
            await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.WBTC.getAddress(), WBTCprovideAmount)

            await time.increase(31536000)

            expect(await calculateInterestServiceFee(
                marginAccountID,
                c.USDC_LiquidityPool,
                c.WETH_LiquidityPool,
                c.WBTC_LiquidityPool,
                c.ModularSwapRouter,
                c.USDC
            )
            ).to.be.eq(BigInt("16450000"))
        })

        it("calculateMaxAmountToSupply", async () => {
            expect(
                await calculateMaxAmountToSupply(c.USDC_LiquidityPool)
            ).to.be.eq(
                BigInt("89990000000")
            )
        })

        it("calculateChangeMarginRatioAfterRepay repay USDC", async () => {
            await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
            const USDCprovideAmount = parseUnits("400", await c.USDC.decimals())
            const USDCrepayAmount = parseUnits("200", await c.USDC.decimals())
            const marginAccountID = BigInt(0)
            await c.MarginTrading.connect(c.deployer).provideERC20(marginAccountID, await c.USDC.getAddress(), USDCprovideAmount)
            await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.USDC.getAddress(), USDCprovideAmount)
            expect(await calculateChangeMarginRatioAfterRepay(
                marginAccountID, 
                USDCrepayAmount, 
                c.USDC, 
                c.USDC, 
                c.MarginTrading,
                c.ModularSwapRouter
            )).to.be.eq(
                300000n
            )
        })

        it("calculateChangeMarginRatioAfterRepay repay WETH", async () => {
            await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
            const WETHprovideAmount = parseUnits("0.1", await c.WETH.decimals())
            const WETHrepayAmount = parseUnits("0.05", await c.WETH.decimals())
            const marginAccountID = BigInt(0)
            await c.MarginTrading.connect(c.deployer).provideERC20(marginAccountID, await c.WETH.getAddress(), WETHprovideAmount)
            await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.WETH.getAddress(), WETHprovideAmount)
            expect(await calculateChangeMarginRatioAfterRepay(
                marginAccountID, 
                WETHrepayAmount, 
                c.USDC, 
                c.WETH, 
                c.MarginTrading,
                c.ModularSwapRouter
            )).to.be.eq(
                300000n
            )
        })

        it("calculateChangeMarginRatioAfterRepay repay WBTC", async () => {
            await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
            const WBTCprovideAmount = parseUnits("0.01", await c.WBTC.decimals())
            const WBTCrepayAmount = parseUnits("0.005", await c.WBTC.decimals())
            const marginAccountID = BigInt(0)
            await c.MarginTrading.connect(c.deployer).provideERC20(marginAccountID, await c.WBTC.getAddress(), WBTCprovideAmount)
            await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.WBTC.getAddress(), WBTCprovideAmount)
            expect(await calculateChangeMarginRatioAfterRepay(
                marginAccountID, 
                WBTCrepayAmount, 
                c.USDC, 
                c.WBTC, 
                c.MarginTrading,
                c.ModularSwapRouter
            )).to.be.eq(
                300000n
            )
        })

        it("calculateWithdrawAmount", async () => {
            const user_balance = await calculateUserSupplied(c.USDC_LiquidityPool, c.deployer)
            expect(
                await calculateWithdrawAmount(user_balance/BigInt(2), c.USDC_LiquidityPool, c.deployer)
            ).to.be.eq(
                await c.USDC_LiquidityPool.balanceOf(await c.deployer.getAddress()) / BigInt(2)
            )
            expect(
                await calculateWithdrawAmount(user_balance/BigInt(4), c.USDC_LiquidityPool, c.deployer)
            ).to.be.eq(
                await c.USDC_LiquidityPool.balanceOf(await c.deployer.getAddress()) / BigInt(4)
            )
            expect(
                await calculateWithdrawAmount(user_balance/BigInt(5), c.USDC_LiquidityPool, c.deployer)
            ).to.be.eq(
                await c.USDC_LiquidityPool.balanceOf(await c.deployer.getAddress()) / BigInt(5)
            )
        })

        it("calculateChangeMarginRatioAfterProvide provide USDC", async () => {
            await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
            const USDCprovideAmount = parseUnits("400", await c.USDC.decimals())
            const marginAccountID = BigInt(0)
            await c.MarginTrading.connect(c.deployer).provideERC20(marginAccountID, await c.USDC.getAddress(), USDCprovideAmount)
            await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.USDC.getAddress(), USDCprovideAmount)
            expect(await calculateChangeMarginRatioAfterProvide(
                marginAccountID, 
                USDCprovideAmount, 
                c.USDC, 
                c.USDC, 
                c.MarginTrading,
                c.ModularSwapRouter
            )).to.be.eq(
                300000n
            )
        })

        it("calculateChangeMarginRatioAfterProvide provide WETH", async () => {
            await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
            const WETHprovideAmount = parseUnits("0.01", await c.WETH.decimals())
            const marginAccountID = BigInt(0)
            await c.MarginTrading.connect(c.deployer).provideERC20(marginAccountID, await c.WETH.getAddress(), WETHprovideAmount)
            await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.WETH.getAddress(), WETHprovideAmount)
            expect(await calculateChangeMarginRatioAfterProvide(
                marginAccountID, 
                WETHprovideAmount, 
                c.USDC, 
                c.WETH, 
                c.MarginTrading,
                c.ModularSwapRouter
            )).to.be.eq(
                300000n
            )
        })

        it("calculateChangeMarginRatioAfterProvide provide WBTC", async () => {
            await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
            const WBTCprovideAmount = parseUnits("0.001", await c.WBTC.decimals())
            const marginAccountID = BigInt(0)
            await c.MarginTrading.connect(c.deployer).provideERC20(marginAccountID, await c.WBTC.getAddress(), WBTCprovideAmount)
            await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.WBTC.getAddress(), WBTCprovideAmount)
            expect(await calculateChangeMarginRatioAfterProvide(
                marginAccountID, 
                WBTCprovideAmount, 
                c.USDC, 
                c.WBTC, 
                c.MarginTrading,
                c.ModularSwapRouter
            )).to.be.eq(
                300000n
            )
        })

        it("calculateChangeMarginRatioAfterWithdraw withdraw USDC", async () => {
            await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
            const USDCprovideAmount = parseUnits("400", await c.USDC.decimals())
            const USDCwithdrawAmount = parseUnits("200", await c.USDC.decimals())
            const marginAccountID = BigInt(0)
            await c.MarginTrading.connect(c.deployer).provideERC20(marginAccountID, await c.USDC.getAddress(), USDCprovideAmount)
            await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.USDC.getAddress(), USDCprovideAmount)
            await c.MarginTrading.connect(c.deployer).withdrawERC20(marginAccountID, await c.USDC.getAddress(), USDCwithdrawAmount)
            expect(await calculateChangeMarginRatioAfterWithdraw(
                marginAccountID, 
                USDCprovideAmount, 
                c.USDC, 
                c.USDC, 
                c.MarginTrading,
                c.ModularSwapRouter
            )).to.be.eq(
                49999n
            )
        })

        it("calculateChangeMarginRatioAfterWithdraw withdraw WETH", async () => {
            await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
            const WETHprovideAmount = parseUnits("0.01", await c.WETH.decimals())
            const WETHwithdrawAmount = parseUnits("0.005", await c.WETH.decimals())
            const marginAccountID = BigInt(0)
            await c.MarginTrading.connect(c.deployer).provideERC20(marginAccountID, await c.WETH.getAddress(), WETHprovideAmount)
            await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.WETH.getAddress(), WETHprovideAmount)
            await c.MarginTrading.connect(c.deployer).withdrawERC20(marginAccountID, await c.WETH.getAddress(), WETHwithdrawAmount)
            expect(await calculateChangeMarginRatioAfterWithdraw(
                marginAccountID, 
                WETHprovideAmount, 
                c.USDC, 
                c.WETH, 
                c.MarginTrading,
                c.ModularSwapRouter
            )).to.be.eq(
                50000n
            )
        })

        it("calculateChangeMarginRatioAfterWithdraw withdraw WBTC", async () => {
            await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
            const WBTCprovideAmount = parseUnits("0.001", await c.WBTC.decimals())
            const WBTCwithdrawAmount = parseUnits("0.0005", await c.WBTC.decimals())
            const marginAccountID = BigInt(0)
            await c.MarginTrading.connect(c.deployer).provideERC20(marginAccountID, await c.WBTC.getAddress(), WBTCprovideAmount)
            await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.WBTC.getAddress(), WBTCprovideAmount)
            await c.MarginTrading.connect(c.deployer).withdrawERC20(marginAccountID, await c.WBTC.getAddress(), WBTCwithdrawAmount)
            expect(await calculateChangeMarginRatioAfterWithdraw(
                marginAccountID, 
                WBTCprovideAmount, 
                c.USDC, 
                c.WBTC, 
                c.MarginTrading,
                c.ModularSwapRouter
            )).to.be.eq(
                50000n
            )
        })


        
    })
})