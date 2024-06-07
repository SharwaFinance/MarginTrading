import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect, assert } from "chai";
import { ethers } from "hardhat";
import { Signer, parseUnits, keccak256, toUtf8Bytes, ZeroAddress  } from "ethers";
import { USDCMock, LiquidityPool, MarginTradingMock } from "../typechain-types";

describe("liquidity_pool.spec.sol", function () {
  let USDC: USDCMock
  let liquidityPoolUSDC: LiquidityPool
  let deployer: Signer
  let firstInvestor: Signer
  let secondInvestor: Signer
  let firstTrader: Signer
  let secondTrader: Signer
  let marginTrading: MarginTradingMock
  let insurancePool: Signer

  beforeEach(async () => {
    [
      deployer,
      firstInvestor,
      secondInvestor,
      firstTrader,
      secondTrader,
      insurancePool,
    ] = await ethers.getSigners();

    const MANAGER_ROLE = keccak256(toUtf8Bytes("MANAGER_ROLE"));

    const USDCMock = await ethers.getContractFactory("USDCMock");
    USDC = await USDCMock.deploy();

    const MarginTradingMock = await ethers.getContractFactory("MarginTradingMock");
    marginTrading = await MarginTradingMock.deploy();
    await marginTrading.setInsurancePoolContract(await insurancePool.getAddress());
    
    const LiquidityPoolUSDC = await ethers.getContractFactory("LiquidityPool");
    liquidityPoolUSDC = await LiquidityPoolUSDC.deploy(
      await insurancePool.getAddress(),
      await marginTrading.getAddress(),
      await USDC.getAddress(),
      await USDC.getAddress(),
      'SF-LP-USDC',
      'SF-LP-USDC',
      parseUnits("500000", 6)
    ) ;
    await marginTrading.setLiquidityPoolContract(await liquidityPoolUSDC.getAddress());
    await liquidityPoolUSDC.grantRole(MANAGER_ROLE, deployer)

    const amountOtherUSDC = ethers.parseUnits("5000", 6);
    await USDC.transfer(await firstInvestor.getAddress(), amountOtherUSDC); // Send 5000 USDC for tests
    await USDC.transfer(await secondInvestor.getAddress(), amountOtherUSDC); // Send 5000 USDC for tests

    await liquidityPoolUSDC.connect(deployer).setInterestRate(ethers.parseUnits("500", 0));
  })

  describe("Check deployment", function () {
    it("balance of USDC & minted shares of LiquidityPoolUSDC", async function () {
      const amount = ethers.parseUnits("0", 6);
      expect(await liquidityPoolUSDC.getTotalLiquidity()).to.equal(amount);
      expect(await liquidityPoolUSDC.depositShare()).to.equal(amount);
    });

    it("addresses", async function () {
      const MARGIN_ACCOUNT_ROLE = await liquidityPoolUSDC.MARGIN_ACCOUNT_ROLE()
      expect(await liquidityPoolUSDC.hasRole(MARGIN_ACCOUNT_ROLE, await marginTrading.getAddress())).to.be.true
    });
  });

  describe("Check investors functionality positive", function () {
    it("(provide) Investor sends 1000 tokens to LiquidityPool one time", async function () {
      const amount = ethers.parseUnits("1000", 6);
      await USDC.connect(firstInvestor).approve(liquidityPoolUSDC.getAddress(), amount);

      await liquidityPoolUSDC.connect(firstInvestor).provide(amount);

      const amountCheck = ethers.parseUnits("4000", 6);
      const amountCheckShareTokens = ethers.parseUnits("1000", 18);

      expect(
        await USDC.balanceOf(await firstInvestor.getAddress()),
        "balance of the investor should have decreased to " + amountCheck
      ).to.equal(amountCheck);
      expect(
        await USDC.balanceOf(await liquidityPoolUSDC.getAddress()),
        "balance of the LiquidityPoolUSDC should have increased to " + amount
      ).to.equal(amount);
      expect(
        await liquidityPoolUSDC.balanceOf(await firstInvestor.getAddress()),
        "tokens sent to the investor should have been equal to " +
        amountCheckShareTokens
      ).to.equal(amountCheckShareTokens);
    });
    it("(provide) Investor sends tokens to LiquidityPool two times in a row", async function () {
      const amount = ethers.parseUnits("1000", 6);

      await USDC.connect(firstInvestor).approve(liquidityPoolUSDC.getAddress(), amount);
      await liquidityPoolUSDC.connect(firstInvestor).provide(amount);

      await USDC.connect(firstInvestor).approve(liquidityPoolUSDC.getAddress(), amount);
      await liquidityPoolUSDC.connect(firstInvestor).provide(amount);

      const amountCheck = ethers.parseUnits("3000", 6);
      const amountCheckLP = ethers.parseUnits("2000", 6);
      const amountCheckShareTokens = ethers.parseUnits("2000", 18);

      expect(
        await USDC.balanceOf(await firstInvestor.getAddress()),
        "balance of the investor should have decreased to " + amountCheck
      ).to.equal(amountCheck);
      expect(
        await USDC.balanceOf(await liquidityPoolUSDC.getAddress()),
        "balance of the LiquidityPoolUSDC should have increased to " + amountCheckLP
      ).to.equal(amountCheckLP);
      expect(
        await liquidityPoolUSDC.balanceOf(await firstInvestor.getAddress()),
        "tokens sent to the investor should have been equal to " +
        amountCheckShareTokens
      ).to.equal(amountCheckShareTokens);
    });
    it("(provide) Two investors send tokens to LiquidityPool one time they can exchange shares", async function () {
      let amount = ethers.parseUnits("1000", 6);

      // first sends 1000 from 5000 acc
      await USDC.connect(firstInvestor).approve(liquidityPoolUSDC.getAddress(), amount);
      await liquidityPoolUSDC.connect(firstInvestor).provide(amount);

      const amountCheckFirstInvestor = ethers.parseUnits("4000", 6);
      const amountCheckShareTokensFirstInvestor = ethers.parseUnits("1000", 18);

      // check first before second
      expect(
        await USDC.balanceOf(await firstInvestor.getAddress()),
        "balance of the investor should have decreased to " +
        amountCheckFirstInvestor
      ).to.equal(amountCheckFirstInvestor);
      expect(
        await USDC.balanceOf(await liquidityPoolUSDC.getAddress()),
        "balance of the LiquidityPoolUSDC should have increased to " + amount
      ).to.equal(amount);
      expect(
        await liquidityPoolUSDC.balanceOf(await firstInvestor.getAddress()),
        "tokens sent to the investor should have been equal to " +
        amountCheckShareTokensFirstInvestor
      ).to.equal(amountCheckShareTokensFirstInvestor);

      // second sends 500 from 5000 acc
      amount = ethers.parseUnits("500", 6);
      await USDC.connect(secondInvestor).approve(liquidityPoolUSDC.getAddress(), amount);
      await liquidityPoolUSDC.connect(secondInvestor).provide(amount);

      const amountCheckSecondInvestor = ethers.parseUnits("4500", 6);
      const amountCheckShareTokensSecondInvestor = ethers.parseUnits("500", 18);
      const amountLP = ethers.parseUnits("1500", 6);

      expect(
        await USDC.balanceOf(await secondInvestor.getAddress()),
        "balance of the investor should have decreased to " +
        amountCheckSecondInvestor
      ).to.equal(amountCheckSecondInvestor);
      expect(
        await USDC.balanceOf(await liquidityPoolUSDC.getAddress()),
        "balance of the LiquidityPoolUSDC should have increased to " + amountLP
      ).to.equal(amountLP);
      expect(
        await liquidityPoolUSDC.balanceOf(await await secondInvestor.getAddress()),
        "tokens sent to the investor should have been equal to " +
        amountCheckShareTokensSecondInvestor
      ).to.equal(amountCheckShareTokensSecondInvestor);

      // share exchange of 250 tokens
      const amountExchange = ethers.parseUnits("250", 18);
      await liquidityPoolUSDC
        .connect(secondInvestor)
        .transfer(await firstInvestor.getAddress(), amountExchange);

      assert.isBelow(
        Number(await liquidityPoolUSDC.balanceOf(await secondInvestor.getAddress())),
        Number(amountCheckShareTokensSecondInvestor),
        "secondBalance should have decreased"
      );
      
      assert.isAbove(
        Number(await liquidityPoolUSDC.balanceOf(await firstInvestor.getAddress())),
        Number(amountCheckShareTokensFirstInvestor),
        "firstBalance should have increased"
      );
    });
    it("(withdraw) Two investors have SF-LP tokens and the second one transferred his SF-LP to the first one, the first one outputs all SF-LP", async function () {
      let amount = ethers.parseUnits("1000", 6);

      const balanceFirstInvestorBefore = await USDC.balanceOf(
        await firstInvestor.getAddress()
      );
      // first sends 1000 from 5000 acc
      await USDC.connect(firstInvestor).approve(liquidityPoolUSDC.getAddress(), amount);
      await liquidityPoolUSDC.connect(firstInvestor).provide(amount);

      const amountCheckFirstInvestor = ethers.parseUnits("4000", 6);
      const amountCheckShareTokensFirstInvestor = ethers.parseUnits("1000", 18);

      // check first before second
      expect(
        await USDC.balanceOf(await firstInvestor.getAddress()),
        "balance of the investor should have decreased to " +
        amountCheckFirstInvestor
      ).to.equal(amountCheckFirstInvestor);
      expect(
        await USDC.balanceOf(await liquidityPoolUSDC.getAddress()),
        "balance of the LiquidityPoolUSDC should have increased to " + amount
      ).to.equal(amount);
      expect(
        await liquidityPoolUSDC.balanceOf(await firstInvestor.getAddress()),
        "tokens sent to the investor should have been equal to " +
        amountCheckShareTokensFirstInvestor
      ).to.equal(amountCheckShareTokensFirstInvestor);

      // second sends 500 from 5000 acc
      amount = ethers.parseUnits("500", 6);
      await USDC.connect(secondInvestor).approve(liquidityPoolUSDC.getAddress(), amount);
      await liquidityPoolUSDC.connect(secondInvestor).provide(amount);

      const amountCheckSecondInvestor = ethers.parseUnits("4500", 6);
      const amountCheckShareTokensSecondInvestor = ethers.parseUnits("500", 18);
      const amountLP = ethers.parseUnits("1500", 6);

      expect(
        await USDC.balanceOf(await secondInvestor.getAddress()),
        "balance of the investor should have decreased to " +
        amountCheckSecondInvestor
      ).to.equal(amountCheckSecondInvestor);
      expect(
        await USDC.balanceOf(await liquidityPoolUSDC.getAddress()),
        "balance of the LiquidityPoolUSDC should have increased to " + amountLP
      ).to.equal(amountLP);
      expect(
        await liquidityPoolUSDC.balanceOf(await await secondInvestor.getAddress()),
        "tokens sent to the investor should have been equal to " +
        amountCheckShareTokensSecondInvestor
      ).to.equal(amountCheckShareTokensSecondInvestor);

      // share exchange of 250 tokens
      const amountExchange = ethers.parseUnits("250", 18);
      await liquidityPoolUSDC
        .connect(secondInvestor)
        .transfer(await firstInvestor.getAddress(), amountExchange);

      const amountWithdraw = ethers.parseUnits("1250", 18);
      await liquidityPoolUSDC.connect(firstInvestor).withdraw(amountWithdraw);
      await liquidityPoolUSDC
        .connect(secondInvestor)
        .withdraw(amountExchange);

      const answer = balanceFirstInvestorBefore + ethers.parseUnits("250", 6);
      const balanceFirstInvestorAfter = await USDC.balanceOf(
        await firstInvestor.getAddress()
      );

      expect(
        answer,
        "the investor's balance should have increased to " + amountExchange
      ).to.equal(balanceFirstInvestorAfter);
    });
    it("(withdraw) Investor withdraws tokens from LiquidityPool fully", async function () {
      const amount = ethers.parseUnits("1000", 6);

      await USDC.connect(firstInvestor).approve(liquidityPoolUSDC.getAddress(), amount);
      await liquidityPoolUSDC.connect(firstInvestor).provide(amount);

      const amountCheck = ethers.parseUnits("5000", 6);
      const amountCheckLP = ethers.parseUnits("0", 6);
      const amountCheckShareTokens = ethers.parseUnits("0", 18);

      await liquidityPoolUSDC
        .connect(firstInvestor)
        .approve(
          liquidityPoolUSDC.getAddress(),
          await liquidityPoolUSDC.balanceOf(await firstInvestor.getAddress())
        );
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .withdraw(await liquidityPoolUSDC.balanceOf(await firstInvestor.getAddress()));

      expect(
        await USDC.balanceOf(await firstInvestor.getAddress()),
        "balance of the investor should have increased to " + amountCheck
      ).to.equal(amountCheck);
      expect(
        await USDC.balanceOf(await liquidityPoolUSDC.getAddress()),
        "balance of the LiquidityPoolUSDC should have decreased to " + amountCheckLP
      ).to.equal(amountCheckLP);
      expect(
        await liquidityPoolUSDC.balanceOf(await firstInvestor.getAddress()),
        "tokens sent to the investor should have been equal to " +
        amountCheckShareTokens
      ).to.equal(amountCheckShareTokens);
    });
    it("(withdraw) Investor withdraws tokens from LiquidityPool partially", async function () {
      const amount = ethers.parseUnits("1000", 6);

      await USDC.connect(firstInvestor).approve(liquidityPoolUSDC.getAddress(), amount);
      await liquidityPoolUSDC.connect(firstInvestor).provide(amount);

      const amountCheck = ethers.parseUnits("4020", 6);
      const amountCheckLP = ethers.parseUnits("980", 6);
      const amountCheckShareTokens = ethers.parseUnits("980", 18);

      const amountPartially = ethers.parseUnits("10", 18);

      await liquidityPoolUSDC
        .connect(firstInvestor)
        .approve(
          liquidityPoolUSDC.getAddress(),
          await liquidityPoolUSDC.balanceOf(await firstInvestor.getAddress())
        );
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .withdraw(amountPartially);
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .withdraw(amountPartially);

      expect(
        await USDC.balanceOf(await firstInvestor.getAddress()),
        "balance of the investor should have increased to " + amountCheck
      ).to.equal(amountCheck);
      expect(
        await USDC.balanceOf(await liquidityPoolUSDC.getAddress()),
        "balance of the LiquidityPoolUSDC should have decreased to " + amountCheckLP
      ).to.equal(amountCheckLP);
      expect(
        await liquidityPoolUSDC.balanceOf(await firstInvestor.getAddress()),
        "tokens sent to the investor should have been equal to " +
        amountCheckShareTokens
      ).to.equal(amountCheckShareTokens);
    });
    it("(withdraw) Investor can withdraw tokens when the LiquidityPool is fully filled", async function () {
      const amount = ethers.parseUnits("500000", 6);

      await USDC.transfer(await firstInvestor.getAddress(), amount);

      await USDC
        .connect(firstInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amount);
      await liquidityPoolUSDC.connect(firstInvestor).provide(amount);

      const amountSecond = ethers.parseUnits("10", 6);
      await USDC
        .connect(firstInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountSecond);

      const amountCheckShareTokens = ethers.parseUnits("499990", 18);

      const amountSecondShareTokens = ethers.parseUnits("10", 18);
      await expect(liquidityPoolUSDC.connect(firstInvestor).provide(amountSecond))
        .to.be.revertedWith("Maximum liquidity has been achieved!");
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .withdraw(amountSecondShareTokens);
      expect(await liquidityPoolUSDC.balanceOf(await firstInvestor.getAddress())).to.equal(
        amountCheckShareTokens
      );
    });
    it("(withdraw) I-5 Two investors withdraw tokens from LiquidityPool even when traded", async function () {
      let amount = ethers.parseUnits("1000", 6);

      // first sends 1000 from 5000 acc
      await USDC.connect(firstInvestor).approve(liquidityPoolUSDC.getAddress(), amount);
      await liquidityPoolUSDC.connect(firstInvestor).provide(amount);

      const amountCheckFirstInvestor = ethers.parseUnits("4000", 6);
      const amountCheckShareTokensFirstInvestor = ethers.parseUnits("1000", 18);

      // check first before second
      expect(
        await USDC.balanceOf(await firstInvestor.getAddress()),
        "balance of the investor should have decreased to " +
        amountCheckFirstInvestor
      ).to.equal(amountCheckFirstInvestor);
      expect(
        await USDC.balanceOf(await liquidityPoolUSDC.getAddress()),
        "balance of the LiquidityPoolUSDC should have increased to " + amount
      ).to.equal(amount);
      expect(
        await liquidityPoolUSDC.balanceOf(await firstInvestor.getAddress()),
        "tokens sent to the investor should have been equal to " +
        amountCheckShareTokensFirstInvestor
      ).to.equal(amountCheckShareTokensFirstInvestor);

      // first trader issues debt
      amount = ethers.parseUnits("500", 6);
      await marginTrading
        .connect(firstTrader)
        .borrow(ethers.parseUnits("1", 0), amount);

      expect(
        await liquidityPoolUSDC.netDebt() + await liquidityPoolUSDC.totalInterestSnapshot(),
        "Total borrowed money should be equal to " + amount
      ).to.equal(amount);

      // first investor cannot withdraw all amount
      amount = ethers.parseUnits("1000", 18);
      expect(
        liquidityPoolUSDC.connect(firstInvestor).withdraw(amount)
      ).to.be.revertedWith("Liquidity pool has not enough free tokens!");

      // second sends 500 from 5000 acc
      amount = ethers.parseUnits("1001", 6);

      await USDC.connect(secondInvestor).approve(liquidityPoolUSDC.getAddress(), amount);
      await liquidityPoolUSDC.connect(secondInvestor).provide(amount);

      const amountCheckSecondInvestor = ethers.parseUnits("3999", 6);
      const amountCheckShareTokensSecondInvestor = ethers.parseUnits(
        "1001",
        18
      );
      const amountLP = ethers.parseUnits("1501", 6);

      expect(
        await USDC.balanceOf(await secondInvestor.getAddress()),
        "balance of the investor should have decreased to " +
        amountCheckSecondInvestor
      ).to.equal(amountCheckSecondInvestor);
      expect(
        await USDC.balanceOf(await liquidityPoolUSDC.getAddress()),
        "balance of the LiquidityPoolUSDC should have increased to " + amountLP
      ).to.equal(amountLP);
      await liquidityPoolUSDC
        .connect(secondInvestor)
        .withdraw(
          (await liquidityPoolUSDC.balanceOf(await secondInvestor.getAddress())) /
          ethers.parseUnits("2", 0)
        );
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .withdraw(
          (await liquidityPoolUSDC.balanceOf(await firstInvestor.getAddress())) /
          ethers.parseUnits("2", 0)
        );
    });
    it("(withdraw) I-2 The second investor -> deposited money -> accrued profit -> withdrew money", async function () {
      await USDC
        .connect(firstInvestor).transfer(await marginTrading.getAddress(), ethers.parseUnits("50", 6));

      // first investor sends 1000 from 5000 acc
      const amountFirstInvestor = ethers.parseUnits("3000", 6);
      await USDC
        .connect(firstInvestor)
        .approve(liquidityPoolUSDC.getAddress(), amountFirstInvestor);
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .provide(amountFirstInvestor);

      // second investor sends 1000 from 5000 acc
      const amountSecondInvestor = ethers.parseUnits("3000", 6);
      await USDC
        .connect(secondInvestor)
        .approve(liquidityPoolUSDC.getAddress(), amountSecondInvestor);
      await liquidityPoolUSDC
        .connect(secondInvestor)
        .provide(amountSecondInvestor);

      const firstTraderDebtAmount = ethers.parseUnits("1000", 6);

      await marginTrading
        .connect(firstTrader)
        .borrow(ethers.parseUnits("1", 0), firstTraderDebtAmount);

      await time.increaseTo(await time.latest() + 60 * 60 * 24 - 1);

      const returnAmount = await liquidityPoolUSDC.getDebtWithAccruedInterestOnTime(ethers.parseUnits("1", 0), await time.latest() + 1);
      await expect(
        await marginTrading.connect(secondTrader).repay(
          ethers.parseUnits("1", 0),
          returnAmount, // repayment of the entire debt, it is expected that MarginTrading will independently call this function
          await USDC.getAddress(),
          returnAmount
        )
      )
        .to.emit(liquidityPoolUSDC, "Repay")
        .withArgs(
          ethers.parseUnits("1", 0),
          returnAmount,
          ethers.parseUnits("133680", 0)
        );

      await liquidityPoolUSDC
        .connect(secondInvestor)
        .withdraw(
          await liquidityPoolUSDC.balanceOf(await secondInvestor.getAddress())
        );

      expect(await USDC.balanceOf(insurancePool)).to.equal(ethers.parseUnits("6684", 0));

      // comparing calculated investor's profit to real
      expect(
        await USDC.balanceOf(await secondInvestor.getAddress()),
        "after withdrawal balance of the investor should be equal to 5000063498"
      ).to.equal(ethers.parseUnits("5000063498", 0));
    });
  });

  describe("Check investors functionality negative", function () {
    it("(provide) Investor sends more tokens to LiquidityPool than maximum liquidity", async function () {
      const amount = ethers.parseUnits("500000", 6);

      await USDC.transfer(await firstInvestor.getAddress(), amount);

      await USDC.connect(firstInvestor).approve(liquidityPoolUSDC.getAddress(), amount);
      await liquidityPoolUSDC.connect(firstInvestor).provide(amount);

      const amountSecond = ethers.parseUnits("10", 6);
      await USDC
        .connect(firstInvestor)
        .approve(liquidityPoolUSDC.getAddress(), amountSecond);

      expect(liquidityPoolUSDC.connect(firstInvestor).provide(amountSecond))
        .to.be.revertedWith("Maximum liquidity has been achieved!");
    });

    it("(withdraw) Investor withdraws tokens when there is no pool tokens in LiquidityPool", async function () {
      expect(
        liquidityPoolUSDC
          .connect(firstInvestor)
          .withdraw(await liquidityPoolUSDC.balanceOf(await firstInvestor.getAddress()))
      ).to.be.revertedWith("Liquidity pool has no pool tokens");
    });

    it("(withdraw) Investor withdraws tokens when there are no free pool tokens in LiquidityPool (traded by traders)", async function () {
      const amountFirstInvestor = ethers.parseUnits("1000", 6);
      await USDC
        .connect(firstInvestor)
        .approve(liquidityPoolUSDC.getAddress(), amountFirstInvestor);
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .provide(amountFirstInvestor);

      const amountSecondInvestor = ethers.parseUnits("500", 6);
      await USDC
        .connect(secondInvestor)
        .approve(liquidityPoolUSDC.getAddress(), amountSecondInvestor);
      await liquidityPoolUSDC
        .connect(secondInvestor)
        .provide(amountSecondInvestor);

      await marginTrading
        .connect(firstTrader)
        .borrow(
          ethers.parseUnits("1", 0),
          ethers.parseUnits("600", 6)
        );
      await marginTrading
        .connect(secondTrader)
        .borrow(
          ethers.parseUnits("2", 0),
          ethers.parseUnits("500", 6)
        );

      expect(
        liquidityPoolUSDC
          .connect(secondInvestor)
          .withdraw(amountSecondInvestor)
      ).to.be.revertedWith("Liquidity pool has not enough free tokens!");
    });
  });
  describe("Check traders functionality positive", function () {
    it("(repay) T-1 The first and second trader borrowed tokens -> No profit -> Returned the tokens", async function () {
      let amount = ethers.parseUnits("1000", 6);
      await USDC
        .connect(firstInvestor)
        .transfer(await insurancePool.getAddress(), amount); // We transfer part of the money to the insurance pool (we simulate the availability of money)

      const amountFirstInvestor = ethers.parseUnits("1000", 6);
      await USDC
        .connect(firstInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountFirstInvestor);
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .provide(amountFirstInvestor);

      const amountSecondInvestor = ethers.parseUnits("500", 6);
      await USDC
        .connect(secondInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountSecondInvestor);
      await liquidityPoolUSDC
        .connect(secondInvestor)
        .provide(amountSecondInvestor);

      await marginTrading
        .connect(firstTrader)
        .borrow(
          ethers.parseUnits("1", 0),
          ethers.parseUnits("300", 6)
        );
      await marginTrading
        .connect(secondTrader)
        .borrow(
          ethers.parseUnits("2", 0),
          ethers.parseUnits("600", 6)
        );

      await time.increaseTo(await time.latest() + 60);

      await USDC
        .connect(insurancePool)
        .approve(
          await marginTrading.getAddress(),
          (await liquidityPoolUSDC.getDebtWithAccruedInterestOnTime(ethers.parseUnits("1", 0), await time.latest() + 2)) -
          ethers.parseUnits("300", 6)
        );
      // Expected work from MarginTrading
      await marginTrading.connect(firstTrader).repay(
        ethers.parseUnits("1", 0),
        await liquidityPoolUSDC.getDebtWithAccruedInterestOnTime(ethers.parseUnits("1", 0), await time.latest() + 1), // repayment of the entire debt, it is expected that MarginTrading will independently call this function
        await USDC.getAddress(),
        ethers.parseUnits("300", 6)
      );

      await USDC
        .connect(insurancePool)
        .approve(
          await marginTrading.getAddress(),
          (await liquidityPoolUSDC.getDebtWithAccruedInterestOnTime(ethers.parseUnits("2", 0), await time.latest() + 2)) -
          ethers.parseUnits("600", 6)
        );
      // Expected work from MarginTrading
      await marginTrading.connect(secondTrader).repay(
        ethers.parseUnits("2", 0),
        await liquidityPoolUSDC.getDebtWithAccruedInterestOnTime(ethers.parseUnits("2", 0), await time.latest() + 1), // repayment of the entire debt, it is expected that MarginTrading will independently call this function
        await USDC.getAddress(),
        ethers.parseUnits("600", 6)
      );

      const checkAmountFirstInvestorAfter =
        ((await liquidityPoolUSDC.balanceOf(await firstInvestor.getAddress())) *
          (await liquidityPoolUSDC.getTotalLiquidity())) /
        (await liquidityPoolUSDC.depositShare());

      assert.isAbove(
        Number(checkAmountFirstInvestorAfter),
        Number(amountFirstInvestor),
        "The balance of the first investor should be slightly larger than the initial one, as this guarantees an insurance pool"
      );

      const checkAmountSecondInvestorAfter =
        ((await liquidityPoolUSDC.balanceOf(await firstInvestor.getAddress())) *
          (await liquidityPoolUSDC.getTotalLiquidity())) /
        (await liquidityPoolUSDC.depositShare());

      assert.isAbove(
        Number(checkAmountSecondInvestorAfter),
        Number(amountSecondInvestor),
        "The balance of the second investor should be slightly larger than the initial one, as this guarantees an insurance pool"
      );
    });

    it("(repay) T-2 The first and second trader borrowed tokens -> The first and second trader made a profit -> The first and second trader returned the tokens", async function () {
      let amount = ethers.parseUnits("1000", 6);

      const checkBalanceInsurancePoolBefore = await USDC.balanceOf(
        await insurancePool.getAddress()
      );
      await USDC
        .connect(firstInvestor)
        .transfer(await marginTrading.getAddress(), amount); // It is used to simulate the profit of a trader

      const amountFirstInvestor = ethers.parseUnits("1000", 6);
      await USDC
        .connect(firstInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountFirstInvestor);
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .provide(amountFirstInvestor);

      const amountSecondInvestor = ethers.parseUnits("500", 6);
      await USDC
        .connect(secondInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountSecondInvestor);
      await liquidityPoolUSDC
        .connect(secondInvestor)
        .provide(amountSecondInvestor);

      await marginTrading
        .connect(firstTrader)
        .borrow(
          ethers.parseUnits("1", 0),
          ethers.parseUnits("300", 6)
        );
      await marginTrading
        .connect(secondTrader)
        .borrow(
          ethers.parseUnits("2", 0),
          ethers.parseUnits("600", 6)
        );

      await time.increaseTo(await time.latest() + 60);

      // Expected work from MarginTrading
      await marginTrading.connect(firstTrader).repay(
        ethers.parseUnits("1", 0),
        await liquidityPoolUSDC.getDebtWithAccruedInterestOnTime(ethers.parseUnits("1", 0), await time.latest() + 1), // repayment of the entire debt, it is expected that MarginTrading will independently call this function
        await USDC.getAddress(),
        await liquidityPoolUSDC.getDebtWithAccruedInterestOnTime(ethers.parseUnits("1", 0), await time.latest() + 1) // repayment of the entire debt, it is expected that MarginTrading will independently call this function
      );

      // Expected work from MarginTrading
      await marginTrading.connect(secondTrader).repay(
        ethers.parseUnits("2", 0),
        await liquidityPoolUSDC.getDebtWithAccruedInterestOnTime(ethers.parseUnits("2", 0), await time.latest() + 1), // repayment of the entire debt, it is expected that MarginTrading will independently call this function
        await USDC.getAddress(),
        await liquidityPoolUSDC.getDebtWithAccruedInterestOnTime(ethers.parseUnits("2", 0), await time.latest() + 1) // repayment of the entire debt, it is expected that MarginTrading will independently call this function
      );

      expect(
        // await liquidityPoolUSDC.netDebt() + await liquidityPoolUSDC.totalInterestSnapshot(),
        await liquidityPoolUSDC.getDebtWithAccruedInterest(ethers.parseUnits("2", 0)),
        "The debt of traders after a full refund should be zero"
      ).to.equal(ethers.parseUnits("0", 0));

      const checkBalanceInsurancePoolAfter = await USDC.balanceOf(
        await insurancePool.getAddress()
      );
      assert.isAbove(
        Number(checkBalanceInsurancePoolAfter),
        Number(checkBalanceInsurancePoolBefore),
        "A small part of the profit should be transferred to the insurance pool"
      );

      const checkAmountFirstInvestorAfter =
        ((await liquidityPoolUSDC.balanceOf(await firstInvestor.getAddress())) *
          (await liquidityPoolUSDC.getTotalLiquidity())) /
        (await liquidityPoolUSDC.depositShare());

      assert.isAbove(
        Number(checkAmountFirstInvestorAfter),
        Number(amountFirstInvestor),
        "The balance should be slightly larger than the initial one, since the profit has already been received for the first investor"
      );

      const checkAmountSecondInvestorAfter =
        ((await liquidityPoolUSDC.balanceOf(await await secondInvestor.getAddress())) *
          (await liquidityPoolUSDC.getTotalLiquidity())) /
        (await liquidityPoolUSDC.depositShare());

      assert.isAbove(
        Number(checkAmountSecondInvestorAfter),
        Number(amountSecondInvestor),
        "The balance should be slightly larger than the initial one, since the profit has already been received for the second investor"
      );
    });
  });
  describe("Check traders functionality negative", function () {
    it("(repay) T-4 Tried to take more tokens than the maximumBorrowMultiplier deterrent rate", async function () {
      const amountFirstInvestor = ethers.parseUnits("1000", 6);
      await USDC
        .connect(firstInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountFirstInvestor);
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .provide(amountFirstInvestor);

      const amountSecondInvestor = ethers.parseUnits("500", 6);
      await USDC
        .connect(secondInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountSecondInvestor);
      await liquidityPoolUSDC
        .connect(secondInvestor)
        .provide(amountSecondInvestor);

      expect(
        marginTrading
          .connect(firstTrader)
          .borrow(
            ethers.parseUnits("1", 0),
            ethers.parseUnits("1201", 6)
          )
      ).to.be.revertedWith("Limit is exceed!");
    });

    it("(repay) T-5 Tried to give away more tokens than debt with interest", async function () {
      const amountFirstInvestor = ethers.parseUnits("1000", 6);
      await USDC
        .connect(firstInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountFirstInvestor);
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .provide(amountFirstInvestor);

      const amountSecondInvestor = ethers.parseUnits("500", 6);
      await USDC
        .connect(secondInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountSecondInvestor);
      await liquidityPoolUSDC
        .connect(secondInvestor)
        .provide(amountSecondInvestor);

      await marginTrading
        .connect(firstTrader)
        .borrow(
          ethers.parseUnits("1", 0),
          ethers.parseUnits("300", 6)
        );
      await marginTrading
        .connect(secondTrader)
        .borrow(
          ethers.parseUnits("2", 0),
          ethers.parseUnits("600", 6)
        );

      await time.increaseTo(await time.latest() + 60);

      await liquidityPoolUSDC.getDebtWithAccruedInterest(ethers.parseUnits("1", 0))
      await marginTrading.connect(firstTrader).repay(
        ethers.parseUnits("1", 0),
        await liquidityPoolUSDC.getDebtWithAccruedInterest(ethers.parseUnits("1", 0)), // repayment of the entire debt, it is expected that MarginTrading will independently call this function
        await USDC.getAddress(),
        ethers.parseUnits("350", 6)
      );

      expect(
        await liquidityPoolUSDC.portfolioIdToDebt(ethers.parseUnits("1", 0)),
        "The debt of the first trader after the return of tokens should be equal to 0"
      ).to.equal(ethers.parseUnits("0", 6));

      assert.isAbove(
        Number(await USDC.balanceOf(await marginTrading.getAddress())),
        Number(ethers.parseUnits("590", 6)),
        "The portfolio balance has changed more than expected"
      );
    });
  });
  describe("Check contributions to the insurance pool", function () {
    it("(repay) function determines the share of profit to be transferred to the insurance pool", async function () {
      await USDC.transfer(marginTrading.getAddress(), ethers.parseUnits("60", 6));

      const amountFirstInvestor = ethers.parseUnits("2000", 6);
      await USDC
        .connect(firstInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountFirstInvestor);
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .provide(amountFirstInvestor);

      await marginTrading
        .connect(firstTrader)
        .borrow(
          ethers.parseUnits("1", 0),
          ethers.parseUnits("1000", 6)
        );

      await time.increaseTo(await time.latest() + 60 * 60 * 24 * 365);

      // get current insuranceRateMultiplier
      const insuranceRateMultiplier = await liquidityPoolUSDC.insuranceRateMultiplier();

      const firstTraderDebtWithInterest = await liquidityPoolUSDC.getDebtWithAccruedInterestOnTime(
        ethers.parseUnits("1", 0), await time.latest() + 1
      );

      // first trader
      // returns debt with interest
      // insurance pool gets share of profit
      await marginTrading
        .connect(firstTrader)
        .repay(
          ethers.parseUnits("1", 0),
          firstTraderDebtWithInterest,
          await USDC.getAddress(),
          firstTraderDebtWithInterest
        );

      expect(
        await USDC.balanceOf(await insurancePool.getAddress()),
        "insurance pool should have gotten "
      ).to.equal(
        (firstTraderDebtWithInterest - ethers.parseUnits("1000", 6)) *
        insuranceRateMultiplier / ethers.parseUnits("10000", 0)
      );
    });
  });
  describe("Check emitted events", function () {
    it("(Provide, Withdraw, Borrow, UpdateInterestRate, UpdateMaximumPoolCapacity, Repay)", async function () {
      await USDC.transfer(marginTrading.getAddress(), ethers.parseUnits("50", 6));

      const amountFirstInvestor = ethers.parseUnits("1000", 6);
      await USDC
        .connect(firstInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountFirstInvestor);

      // checking event Provide
      await expect(
        liquidityPoolUSDC.connect(firstInvestor).provide(amountFirstInvestor)
      )
        .to.emit(liquidityPoolUSDC, "Provide")
        .withArgs(
          await firstInvestor.getAddress(),
          ethers.parseUnits("1000", 18),
          amountFirstInvestor
        );

      const amountSecondInvestor = ethers.parseUnits("500", 6);
      await USDC
        .connect(secondInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountSecondInvestor);

      // checking event Provide
      await expect(
        liquidityPoolUSDC
          .connect(secondInvestor)
          .provide(amountSecondInvestor)
      )
        .to.emit(liquidityPoolUSDC, "Provide")
        .withArgs(
          await secondInvestor.getAddress(),
          ethers.parseUnits("500", 18),
          amountSecondInvestor
        );

      // checking event Withdraw
      await expect(
        liquidityPoolUSDC
          .connect(secondInvestor)
          .withdraw(ethers.parseUnits("500", 18))
      )
        .to.emit(liquidityPoolUSDC, "Withdraw")
        .withArgs(
          await secondInvestor.getAddress(),
          ethers.parseUnits("500", 18),
          amountSecondInvestor
        );

      await USDC
        .connect(secondInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountSecondInvestor);

      await liquidityPoolUSDC
        .connect(secondInvestor)
        .provide(amountSecondInvestor);

      // checking event Borrow
      await expect(
        marginTrading
          .connect(firstTrader)
          .borrow(
            ethers.parseUnits("1", 0),
            ethers.parseUnits("300", 6)
          )
      )
        .to.emit(liquidityPoolUSDC, "Borrow")
        .withArgs(ethers.parseUnits("1", 0), ethers.parseUnits("300", 6));

      // checking event Borrow
      await expect(
        marginTrading
          .connect(secondTrader)
          .borrow(
            ethers.parseUnits("2", 0),
            ethers.parseUnits("600", 6)
          )
      )
        .to.emit(liquidityPoolUSDC, "Borrow")
        .withArgs(ethers.parseUnits("2", 0), ethers.parseUnits("600", 6));

      // checking event UpdateInterestRate

      await expect(liquidityPoolUSDC.setInterestRate(ethers.parseUnits("500", 0)))
        .to.emit(liquidityPoolUSDC, "UpdateInterestRate")
        .withArgs(ethers.parseUnits("1500000001", 0), ethers.parseUnits("900000001", 0), ethers.parseUnits("500", 0));

      // end of checking event UpdateInterestRate

      // checking event UpdateMaximumPoolCapacity
      const amountNewCapacity = ethers.parseUnits("1000000", 6);
      await expect(liquidityPoolUSDC.setMaximumPoolCapacity(amountNewCapacity))
        .to.emit(liquidityPoolUSDC, "UpdateMaximumPoolCapacity")
        .withArgs(amountNewCapacity);

      // get current insuranceRateMultiplier
      const insuranceRateMultiplier = await liquidityPoolUSDC.insuranceRateMultiplier();

      // get debt and interest of traders
      let firstTraderDebtWithInterest: bigint = await liquidityPoolUSDC.getDebtWithAccruedInterest(
        ethers.parseUnits("1", 0)
      ),
        firstTraderDebt = await liquidityPoolUSDC.portfolioIdToDebt(ethers.parseUnits("1", 0));

      await time.increaseTo(await time.latest() + 50);
      let secondTraderDebtWithInterest: bigint =
        await liquidityPoolUSDC.getDebtWithAccruedInterestOnTime(ethers.parseUnits("2", 0), await time.latest() + 1),
        secondTraderDebt = await liquidityPoolUSDC.portfolioIdToDebt(ethers.parseUnits("2", 0));

      // second trader
      // returns debt with interest
      // insurance pool gets share of profit
      await marginTrading
        .connect(secondTrader)
        .repay(
          ethers.parseUnits("2", 0),
          secondTraderDebtWithInterest,
          await USDC.getAddress(),
          secondTraderDebtWithInterest
        );

      (firstTraderDebtWithInterest = await liquidityPoolUSDC.getDebtWithAccruedInterestOnTime(
        ethers.parseUnits("1", 0), await time.latest() + 1
      )),
        (firstTraderDebt = await liquidityPoolUSDC.portfolioIdToDebt(ethers.parseUnits("1", 0)));

      let newSecondTraderDebtWithInterest =
        await liquidityPoolUSDC.getDebtWithAccruedInterest(ethers.parseUnits("2", 0));

      expect(
        newSecondTraderDebtWithInterest,
        "secondTrader values should be equal to 0"
      ).to.equal(ethers.parseUnits("0", 6));

      let insurancePoolBalance = await USDC.balanceOf(await insurancePool.getAddress());
      expect(
        insurancePoolBalance,
        "insurance pool should have gotten " +
        (secondTraderDebtWithInterest - secondTraderDebt) * insuranceRateMultiplier / ethers.parseUnits("10000", 0)
      ).to.equal((secondTraderDebtWithInterest - secondTraderDebt) * insuranceRateMultiplier / ethers.parseUnits("10000", 0));

      // first trader
      // returns debt with interest
      // insurance pool gets share of profit

      // checking event Repay

      await expect(
        marginTrading
          .connect(firstTrader)
          .repay(
            ethers.parseUnits("1", 0),
            firstTraderDebtWithInterest,
            await USDC.getAddress(),
            firstTraderDebtWithInterest
          )
      )
        .to.emit(liquidityPoolUSDC, "Repay")
        .withArgs(
          ethers.parseUnits("1", 0),
          firstTraderDebtWithInterest,
          firstTraderDebtWithInterest -
          firstTraderDebt -
          (firstTraderDebtWithInterest - firstTraderDebt) *
          insuranceRateMultiplier / ethers.parseUnits("10000", 0)
        );
    });
  });
  describe("Check get total borrows with accrued interest", function () {
    it("(get totalBorrowsSnapshotWithAccruedInterest) A trader came in and borrowed -> interest is accrued -> the debt value is the same", async function () {
      const amountFirstInvestor = ethers.parseUnits("1000", 6);
      await USDC
        .connect(firstInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountFirstInvestor);
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .provide(amountFirstInvestor);

      const amountSecondInvestor = ethers.parseUnits("500", 6);
      await USDC
        .connect(secondInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountSecondInvestor);
      await liquidityPoolUSDC
        .connect(secondInvestor)
        .provide(amountSecondInvestor);

      await marginTrading
        .connect(firstTrader)
        .borrow(
          ethers.parseUnits("1", 0),
          ethers.parseUnits("300", 6)
        );
      await marginTrading
        .connect(secondTrader)
        .borrow(
          ethers.parseUnits("2", 0),
          ethers.parseUnits("600", 6)
        );

      const checkTotalBorrowsSnapshot = await liquidityPoolUSDC.totalBorrows();
      // The beginning of the interest calculation simulation
      const amount = ethers.parseUnits("10", 6);
      await USDC.connect(firstInvestor).transfer(await firstTrader.getAddress(), amount); // In order not to increase the share of the first investor, we use a trader 
      await USDC
        .connect(firstTrader)
        .approve(await liquidityPoolUSDC.getAddress(), amount);
      await liquidityPoolUSDC
        .connect(firstTrader)
        .provide(amount);
      // The end of the interest calculation simulation

      expect(
        await liquidityPoolUSDC.netDebt() + await liquidityPoolUSDC.totalInterestSnapshot(),
        "The value of the total borrows of traders does not match"
      ).to.equal(checkTotalBorrowsSnapshot);
    });

  });
  describe("Checking system inactivity", function () {
    it("The system has been inactive for one day", async function () {
      const amountFirstInvestor = ethers.parseUnits("1000", 6);
      await USDC
        .connect(firstInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountFirstInvestor);
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .provide(amountFirstInvestor);

      const amountSecondInvestor = ethers.parseUnits("500", 6);
      await USDC
        .connect(secondInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountSecondInvestor);
      await liquidityPoolUSDC
        .connect(secondInvestor)
        .provide(amountSecondInvestor);

      await marginTrading
        .connect(firstTrader)
        .borrow(
          ethers.parseUnits("1", 0),
          ethers.parseUnits("300", 6)
        );
      await marginTrading
        .connect(secondTrader)
        .borrow(
          ethers.parseUnits("2", 0),
          ethers.parseUnits("600", 6)
        );

      await time.increaseTo(await time.latest() + 60 * 60 * 24);

      await marginTrading.connect(firstTrader).repay(
        ethers.parseUnits("1", 0),
        await liquidityPoolUSDC.getDebtWithAccruedInterest(ethers.parseUnits("1", 0)), // repayment of the entire debt, it is expected that MarginTrading will independently call this function
        await USDC.getAddress(),
        ethers.parseUnits("300", 6)
      );

      await liquidityPoolUSDC.totalBorrows();

      // check stub, as the correct operation is expected from the totalBorrows function (it should not cause errors)
      expect(ethers.parseUnits("0", 0)).to.equal(ethers.parseUnits("0", 0));
    });

    it("The system has been inactive for a month", async function () {
      const amountFirstInvestor = ethers.parseUnits("1000", 6);
      await USDC
        .connect(firstInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountFirstInvestor);
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .provide(amountFirstInvestor);

      const amountSecondInvestor = ethers.parseUnits("500", 6);
      await USDC
        .connect(secondInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountSecondInvestor);
      await liquidityPoolUSDC
        .connect(secondInvestor)
        .provide(amountSecondInvestor);

      await marginTrading
        .connect(firstTrader)
        .borrow(
          ethers.parseUnits("1", 0),
          ethers.parseUnits("300", 6)
        );
      await marginTrading
        .connect(secondTrader)
        .borrow(
          ethers.parseUnits("2", 0),
          ethers.parseUnits("600", 6)
        );

      await time.increaseTo(await time.latest() + 60 * 60 * 24 * 30);

      await marginTrading.connect(firstTrader).repay(
        ethers.parseUnits("1", 0),
        await liquidityPoolUSDC.getDebtWithAccruedInterest(ethers.parseUnits("1", 0)), // repayment of the entire debt, it is expected that MarginTrading will independently call this function
        await USDC.getAddress(),
        ethers.parseUnits("300", 6)
      );

      await liquidityPoolUSDC.totalBorrows();
      // check stub, as the correct operation is expected from the totalBorrows function (it should not cause errors)
      expect(ethers.parseUnits("0", 0)).to.equal(ethers.parseUnits("0", 0));
    });

    it("The system is inactive for a quarter", async function () {
      const amountFirstInvestor = ethers.parseUnits("1000", 6);
      await USDC
        .connect(firstInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountFirstInvestor);
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .provide(amountFirstInvestor);

      const amountSecondInvestor = ethers.parseUnits("500", 6);
      await USDC
        .connect(secondInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountSecondInvestor);
      await liquidityPoolUSDC
        .connect(secondInvestor)
        .provide(amountSecondInvestor);

      await marginTrading
        .connect(firstTrader)
        .borrow(
          ethers.parseUnits("1", 0),
          ethers.parseUnits("300", 6)
        );
      await marginTrading
        .connect(secondTrader)
        .borrow(
          ethers.parseUnits("2", 0),
          ethers.parseUnits("600", 6)
        );

      await time.increaseTo(await time.latest() + 60 * 60 * 24 * 92);

      await marginTrading.connect(firstTrader).repay(
        ethers.parseUnits("1", 0),
        await liquidityPoolUSDC.getDebtWithAccruedInterest(ethers.parseUnits("1", 0)), // repayment of the entire debt, it is expected that MarginTrading will independently call this function
        await USDC.getAddress(),
        ethers.parseUnits("300", 6)
      );

      await liquidityPoolUSDC.totalBorrows();
      // check stub, as the correct operation is expected from the totalBorrows function (it should not cause errors)
      expect(ethers.parseUnits("0", 0)).to.equal(ethers.parseUnits("0", 0));
    });

    it("The system has been inactive for a year", async function () {
      const amountFirstInvestor = ethers.parseUnits("1000", 6);
      await USDC
        .connect(firstInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountFirstInvestor);
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .provide(amountFirstInvestor);

      const amountSecondInvestor = ethers.parseUnits("500", 6);
      await USDC
        .connect(secondInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountSecondInvestor);
      await liquidityPoolUSDC
        .connect(secondInvestor)
        .provide(amountSecondInvestor);

      await marginTrading
        .connect(firstTrader)
        .borrow(
          ethers.parseUnits("1", 0),
          ethers.parseUnits("300", 6)
        );
      await marginTrading
        .connect(secondTrader)
        .borrow(
          ethers.parseUnits("2", 0),
          ethers.parseUnits("600", 6)
        );

      await time.increaseTo(await time.latest() + 60 * 60 * 24 * 365);

      await marginTrading.connect(firstTrader).repay(
        ethers.parseUnits("1", 0),
        await liquidityPoolUSDC.getDebtWithAccruedInterest(ethers.parseUnits("1", 0)), // repayment of the entire debt, it is expected that MarginTrading will independently call this function
        await USDC.getAddress(),
        ethers.parseUnits("300", 6)
      );

      await liquidityPoolUSDC.totalBorrows();
      // check stub, as the correct operation is expected from the totalBorrows function (it should not cause errors)
      expect(ethers.parseUnits("0", 0)).to.equal(ethers.parseUnits("0", 0));
    });

    it("The system has been inactive for a year and a half", async function () {
      const amountFirstInvestor = ethers.parseUnits("1000", 6);
      await USDC
        .connect(firstInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountFirstInvestor);
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .provide(amountFirstInvestor);

      const amountSecondInvestor = ethers.parseUnits("500", 6);
      await USDC
        .connect(secondInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountSecondInvestor);
      await liquidityPoolUSDC
        .connect(secondInvestor)
        .provide(amountSecondInvestor);

      await marginTrading
        .connect(firstTrader)
        .borrow(
          ethers.parseUnits("1", 0),
          ethers.parseUnits("300", 6)
        );
      await marginTrading
        .connect(secondTrader)
        .borrow(
          ethers.parseUnits("2", 0),
          ethers.parseUnits("600", 6)
        );

      await time.increaseTo(await time.latest() + 60 * 60 * 24 * 548);

      await marginTrading.connect(firstTrader).repay(
        ethers.parseUnits("1", 0),
        await liquidityPoolUSDC.getDebtWithAccruedInterest(ethers.parseUnits("1", 0)), // repayment of the entire debt, it is expected that MarginTrading will independently call this function
        await USDC.getAddress(),
        ethers.parseUnits("300", 6)
      );
      await liquidityPoolUSDC.totalBorrows();
      // check stub, as the correct operation is expected from the totalBorrows function (it should not cause errors)
      expect(ethers.parseUnits("0", 0)).to.equal(ethers.parseUnits("0", 0));
    });

    it("The system has been inactive for a year and max limit trader debt", async function () {
      const amount = ethers.parseUnits("500000", 6);
      await USDC.transfer(await firstInvestor.getAddress(), amount);
      await USDC.connect(firstInvestor).approve(liquidityPoolUSDC.getAddress(), amount);
      await liquidityPoolUSDC.connect(firstInvestor).provide(amount);
      
      await marginTrading
        .connect(firstTrader)
        .borrow(
          ethers.parseUnits("1", 0),
          ethers.parseUnits("300000", 6)
        );
      await marginTrading
        .connect(secondTrader)
        .borrow(
          ethers.parseUnits("2", 0),
          ethers.parseUnits("99900", 6)
        );

      await time.increaseTo(await time.latest() + 60 * 60 * 24 * 365);

      await marginTrading.connect(firstTrader).repay(
        ethers.parseUnits("1", 0),
        await liquidityPoolUSDC.getDebtWithAccruedInterest(ethers.parseUnits("1", 0)), // repayment of the entire debt, it is expected that MarginTrading will independently call this function
        await USDC.getAddress(),
        ethers.parseUnits("300", 6)
      );

      await liquidityPoolUSDC.totalBorrows();
      // check stub, as the correct operation is expected from the totalBorrows function (it should not cause errors)
      expect(ethers.parseUnits("0", 0)).to.equal(ethers.parseUnits("0", 0));
    });

  });

  describe("Checking interest accrual", function () {
    it("Interest for one second", async function () {
      const amountFirstInvestor = ethers.parseUnits("1500", 6);
      await USDC
        .connect(firstInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountFirstInvestor);
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .provide(amountFirstInvestor);

      await marginTrading
        .connect(firstTrader)
        .borrow(
          ethers.parseUnits("1", 0),
          ethers.parseUnits("1000", 6)
        );

      await time.increaseTo(await time.latest() + 1);

      expect(await liquidityPoolUSDC.totalBorrows()).to.equal(ethers.parseUnits("1000000001", 0));
    });
    it("Interest for one day", async function () {
      const amountFirstInvestor = ethers.parseUnits("1500", 6);
      await USDC
        .connect(firstInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountFirstInvestor);
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .provide(amountFirstInvestor);

      await marginTrading
        .connect(firstTrader)
        .borrow(
          ethers.parseUnits("1", 0),
          ethers.parseUnits("1000", 6)
        );

      await time.increaseTo(await time.latest() + 60 * 60 * 24);

      expect(await liquidityPoolUSDC.totalBorrows()).to.equal(ethers.parseUnits("1000133680", 0));
    });
    it("Interest for one month", async function () {
      const amountFirstInvestor = ethers.parseUnits("1500", 6);
      await USDC
        .connect(firstInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountFirstInvestor);
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .provide(amountFirstInvestor);

      await marginTrading
        .connect(firstTrader)
        .borrow(
          ethers.parseUnits("1", 0),
          ethers.parseUnits("1000", 6)
        );

      await time.increaseTo(await time.latest() + 60 * 60 * 24 * 30);

      expect(await liquidityPoolUSDC.totalBorrows()).to.equal(ethers.parseUnits("1004018201", 0));
    });
    it("Interest for one year", async function () {
      const amountFirstInvestor = ethers.parseUnits("1500", 6);
      await USDC
        .connect(firstInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountFirstInvestor);
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .provide(amountFirstInvestor);

      await marginTrading
        .connect(firstTrader)
        .borrow(
          ethers.parseUnits("1", 0),
          ethers.parseUnits("1000", 6)
        );

      await time.increaseTo(await time.latest() + 60 * 60 * 24 * 365);

      expect(await liquidityPoolUSDC.totalBorrows()).to.equal(ethers.parseUnits("1050", 6));
    });
    it("Interest for two years and one second", async function () {
      const amountFirstInvestor = ethers.parseUnits("1500", 6);
      await USDC
        .connect(firstInvestor)
        .approve(await liquidityPoolUSDC.getAddress(), amountFirstInvestor);
      await liquidityPoolUSDC
        .connect(firstInvestor)
        .provide(amountFirstInvestor);

      await marginTrading
        .connect(firstTrader)
        .borrow(
          ethers.parseUnits("1", 0),
          ethers.parseUnits("1000", 6)
        );

      await time.increaseTo(await time.latest() + 60 * 60 * 24 * 730 + 1);

      expect(await liquidityPoolUSDC.totalBorrows()).to.equal(ethers.parseUnits("1102500001", 0));
    });
  });

  describe("AccessControl", async () => {
    let MANAGER_ROLE: string

    beforeEach("role preparation", async () => {
      MANAGER_ROLE = keccak256(toUtf8Bytes("MANAGER_ROLE"));
    })

    it("setMaximumPoolCapacity", async () => {
      const newValue = BigInt(0)
      await liquidityPoolUSDC.connect(deployer).setMaximumPoolCapacity(newValue)
      await expect(
        liquidityPoolUSDC.connect(firstInvestor).setMaximumPoolCapacity(newValue)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08") 
      expect(await liquidityPoolUSDC.maximumPoolCapacity()).to.eq(newValue)
    })

    it("setMaximumBorrowMultiplier", async () => {
      const newValue = BigInt(111e3)
      await liquidityPoolUSDC.connect(deployer).setMaximumBorrowMultiplier(newValue)
      await expect(
        liquidityPoolUSDC.connect(firstInvestor).setMaximumBorrowMultiplier(newValue)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08") 
      expect(await liquidityPoolUSDC.maximumBorrowMultiplier()).to.eq(newValue)
    })

    it("setInsurancePool", async () => {
      await liquidityPoolUSDC.connect(deployer).setInsurancePool(ZeroAddress)
      await expect(
        liquidityPoolUSDC.connect(firstInvestor).setInsurancePool(ZeroAddress)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08") 
      expect(await liquidityPoolUSDC.insurancePool()).to.eq(ZeroAddress)
    })

    it("setInsuranceRateMultiplier", async () => {
      const newValue = BigInt(111e3)
      await liquidityPoolUSDC.connect(deployer).setInsuranceRateMultiplier(newValue)
      await expect(
        liquidityPoolUSDC.connect(firstInvestor).setInsuranceRateMultiplier(newValue)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08") 
      expect(await liquidityPoolUSDC.insuranceRateMultiplier()).to.eq(newValue)
    })

    it("setInterestRate", async () => {
      const newValue = BigInt(111e3)
      await liquidityPoolUSDC.connect(deployer).setInterestRate(newValue)
      await expect(
        liquidityPoolUSDC.connect(firstInvestor).setInterestRate(newValue)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08") 
      expect(await liquidityPoolUSDC.interestRate()).to.eq(newValue)
    })

  })
});
