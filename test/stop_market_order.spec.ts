import { expect } from "chai";
import { ethers } from "hardhat";
import { PreparationResult, prepareContracts } from "../utils/prepareContracts"
import { ZeroAddress, MaxUint256 } from "ethers";

describe("stop_market_order.spec.ts", function () {
  let c: PreparationResult
  let USDCprovideAmount: bigint
  let marginAccountID: number
  let marginAccountID_1: number

  beforeEach(async () => {
    c = await prepareContracts();
    USDCprovideAmount = ethers.parseUnits("500", await c.USDC.decimals());
    await c.MarginAccountManager.connect(c.deployer).createMarginAccount();
    await c.MarginTrading.connect(c.deployer).provideERC20(0, await c.USDC.getAddress(), USDCprovideAmount);
    await c.MarginAccountManager.connect(c.deployer).createMarginAccount();
    await c.MarginTrading.connect(c.deployer).provideERC20(1, await c.USDC.getAddress(), USDCprovideAmount);
    marginAccountID = 0;
    marginAccountID_1 = 1;
  })

  describe("Check availableBorrow", async () => {

    it("The token you are trying to deposit is not available for loan issuance", async () => {
      const newTokenAddress = await c.USDCe.getAddress();
      const amountBorrow = ethers.parseUnits("1", 18);
      const answer = await c.StopMarketOrder.availableBorrow.staticCall(marginAccountID, newTokenAddress, amountBorrow);
      expect(answer, "The error code is different from the expected one (440)").to.eq(ethers.parseUnits("440", 0));
    })

    it("There is no liquidity pool for the specified token", async () => {
      const newTokenAddress = await c.USDCe.getAddress();
      await c.MarginAccount.connect(c.deployer).setIsAvailableErc20(newTokenAddress, true);
      const amountBorrow = ethers.parseUnits("1", 18);
      const answer = await c.StopMarketOrder.availableBorrow.staticCall(marginAccountID, newTokenAddress, amountBorrow);
      expect(answer, "The error code is different from the expected one (441)").to.eq(ethers.parseUnits("441", 0));
    })

    it("The loan amount must be greater than 0", async () => {
      const WETH = await c.WETH;
      const amountBorrow = ethers.parseUnits("0", 18);
      const answer = await c.StopMarketOrder.availableBorrow.staticCall(marginAccountID, WETH.getAddress(), amountBorrow);
      expect(answer, "The error code is different from the expected one (442)").to.eq(ethers.parseUnits("442", 0));
    })

    it("There are not enough tokens in the liquidity pool to provide a loan", async () => {
      const WETH = await c.WETH;
      const amountBorrow = ethers.parseUnits("6000000", 18);
      const answer = await c.StopMarketOrder.availableBorrow.staticCall(marginAccountID, WETH.getAddress(), amountBorrow);
      expect(answer, "The error code is different from the expected one (443)").to.eq(ethers.parseUnits("443", 0));
    })

    it("The limit of tokens for granting a loan has been reached in the liquidity pool", async () => {
      const WETH = await c.WETH;
      const amountBorrow = await c.WETH.balanceOf(c.WETH_LiquidityPool.getAddress()) * ethers.parseUnits("9", 0) / ethers.parseUnits("10", 0);
      const answer = await c.StopMarketOrder.availableBorrow.staticCall(marginAccountID, WETH.getAddress(), amountBorrow);
      expect(answer, "The error code is different from the expected one (444)").to.eq(ethers.parseUnits("444", 0));
    })

    it("It is impossible to borrow because the margin account ratio is too high", async () => {
      const WETH = await c.WETH;
      const amountBorrow = ethers.parseUnits("1", 18);
      await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.USDC.getAddress(), USDCprovideAmount * ethers.parseUnits("9", 0));
      const newYellowCoeff = 1.30 * 1e5;
      await c.MarginTrading.connect(c.deployer).setYellowCoeff(newYellowCoeff);
      const answer = await c.StopMarketOrder.availableBorrow.staticCall(marginAccountID, WETH.getAddress(), amountBorrow);
      expect(answer, "The error code is different from the expected one (445)").to.eq(ethers.parseUnits("445", 0));
    })

    it("The user can borrow token", async () => {
      const WETH = await c.WETH;
      const amountBorrow = ethers.parseUnits("1", 18);
      const answer = await c.StopMarketOrder.availableBorrow.staticCall(marginAccountID, WETH.getAddress(), amountBorrow);
      expect(answer, "The error code is different from the expected one (1)").to.eq(ethers.parseUnits("1", 0));
      await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, WETH.getAddress(), amountBorrow);
      expect(await c.MarginAccount.getErc20ByContract(marginAccountID, WETH.getAddress())).to.eq(amountBorrow);
    })
    
  })

  describe("Check availableRepay", async () => {

    it("The token you are trying to deposit is not available for loan repayment", async () => {
      const addressTokenOut = await c.USDCe.getAddress();
      const amountTokenOut = ethers.parseUnits("12", 17);
      const answer = await c.StopMarketOrder.availableRepay.staticCall(marginAccountID, addressTokenOut, amountTokenOut);
      expect(answer, "The error code is different from the expected one (540)").to.eq(ethers.parseUnits("540", 0));
    })

    it("There are not enough tokens on the balance sheet to repay the debt", async () => {
      const addressTokenOut = await c.WETH.getAddress();
      const amountTokenOut = ethers.parseUnits("12", 17);
      const amountTokenBorrow = ethers.parseUnits("1", 18);
      await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.WETH.getAddress(), amountTokenBorrow);
      await c.MarginTrading.connect(c.deployer).swap(marginAccountID, await c.WETH.getAddress(), await c.USDC.getAddress(), amountTokenBorrow, ethers.parseUnits("0", 0));
      const answer = await c.StopMarketOrder.availableRepay.staticCall(marginAccountID, addressTokenOut, amountTokenOut);
      expect(answer, "The error code is different from the expected one (541)").to.eq(ethers.parseUnits("541", 0));
    })

    it("There is no point in returning 0 tokens", async () => {
      const addressTokenOut = await c.WETH.getAddress();
      const amountTokenOut = ethers.parseUnits("12", 17);
      const answer = await c.StopMarketOrder.availableRepay.staticCall(marginAccountID, addressTokenOut, amountTokenOut);
      expect(answer, "The error code is different from the expected one (542)").to.eq(ethers.parseUnits("542", 0));
    })

    it("The user can return the token", async () => {
      const addressTokenOut = await c.WETH.getAddress();
      const amountTokenOut = ethers.parseUnits("3", 17);
      const amountTokenBorrow = ethers.parseUnits("2", 17);
      await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.WETH.getAddress(), amountTokenBorrow);
      await c.MarginTrading.connect(c.deployer).swap(marginAccountID, await c.USDC.getAddress(), await c.WETH.getAddress(), ethers.parseUnits("100", 6), ethers.parseUnits("0", 0));
      const answer = await c.StopMarketOrder.availableRepay.staticCall(marginAccountID, addressTokenOut, amountTokenOut);
      expect(answer, "The error code is different from the expected one (1)").to.eq(ethers.parseUnits("1", 0));
      await c.MarginTrading.connect(c.deployer).repay(marginAccountID, await c.WETH.getAddress(), amountTokenOut);
      expect(await c.MarginTrading.getMarginAccountRatio.staticCall(marginAccountID)).to.eq(MaxUint256);
      expect(await c.WETH_LiquidityPool.totalBorrows()).to.eq(ethers.parseUnits("0", 0));
    })
    
  })

  describe("Check getAvailableChainLinkData", async () => {

    it("If the addressTokenIn and the addressTokenOut are unavailable, an empty address is returned", async () => {
      const addressTokenIn = await c.USDCe.getAddress();
      const addressTokenOut = await c.USDCe.getAddress();
      expect(await c.StopMarketOrder.getAvailableChainLinkData(addressTokenIn, addressTokenOut)).to.eq(ZeroAddress);
    })

    it("If addressTokenIn is available, a non-empty address is returned", async () => {
      const addressTokenIn = await c.WETH.getAddress();
      const addressTokenOut = await c.USDCe.getAddress();
      expect(await c.StopMarketOrder.getAvailableChainLinkData(addressTokenIn, addressTokenOut)).to.not.eq(ZeroAddress);
    })

    it("If addressTokenOut is available, a non-empty address is returned", async () => {
      const addressTokenIn = await c.USDCe.getAddress();
      const addressTokenOut = await c.WETH.getAddress();
      expect(await c.StopMarketOrder.getAvailableChainLinkData(addressTokenIn, addressTokenOut)).to.not.eq(ZeroAddress);
    })
    
  })
  
  describe("AccessControl", async () => {

    it("setAvailableTokenToChainLinkData", async () => {
      const addressWETH = await c.WETH.getAddress();
      expect(await c.StopMarketOrder.availableTokenToChainLinkData(addressWETH)).to.not.eq(ZeroAddress);
      await c.StopMarketOrder.connect(c.deployer).setAvailableTokenToChainLinkData(addressWETH, ZeroAddress);
      await expect(
        c.StopMarketOrder.connect(c.signers[1]).setAvailableTokenToChainLinkData(addressWETH, ZeroAddress)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08");
      expect(await c.StopMarketOrder.availableTokenToChainLinkData(addressWETH)).to.eq(ZeroAddress);
    })

    it("setMaximumActiveOrders", async () => {
      const answer = ethers.parseUnits("0", 0);
      expect(await c.StopMarketOrder.maximumActiveOrders(), "The default value for active orders does not correspond to reality").to.eq(ethers.parseUnits("2000", 0));
      await c.StopMarketOrder.connect(c.deployer).setMaximumActiveOrders(answer);
      await expect(
        c.StopMarketOrder.connect(c.signers[1]).setMaximumActiveOrders(answer)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08"); 
      expect(await c.StopMarketOrder.maximumActiveOrders()).to.eq(answer);
    })

    it("setMaximumMarginAccountOrders", async () => {
      const answer = ethers.parseUnits("0", 0);
      expect(await c.StopMarketOrder.maximumMarginAccountOrders(), "The default value for orders per user is not true").to.eq(ethers.parseUnits("10", 0));
      await c.StopMarketOrder.connect(c.deployer).setMaximumMarginAccountOrders(answer);
      await expect(
        c.StopMarketOrder.connect(c.signers[1]).setMaximumMarginAccountOrders(answer)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08"); 
      expect(await c.StopMarketOrder.maximumMarginAccountOrders()).to.eq(answer);
    })
    
  })

  describe("Check addOrder", async () => {
    let addressTokenIn: string
    let amountTokenIn: bigint
    let addressTokenOut: string
    let amountTokenOutMinimum: bigint
    let targetPrice: bigint
    let typeConditions: bigint
    let useBorrow: bigint
    let autoRepay: bigint

    beforeEach("InitAdd", async () => {
      addressTokenIn = await c.USDC.getAddress();
      amountTokenIn = ethers.parseUnits("200", await c.USDC.decimals());
      addressTokenOut = await c.WETH.getAddress();
      amountTokenOutMinimum = ethers.parseUnits("0", 0);
      targetPrice = ethers.parseUnits("2100", 8);
      typeConditions = ethers.parseUnits("0", 0);
      useBorrow = ethers.parseUnits("1", 0);
      autoRepay = ethers.parseUnits("0", 0);
    });

    it("It is forbidden to add an application that does not have price information from the oracle", async () => {
      addressTokenIn = await c.USDCe.getAddress();
      addressTokenOut = await c.USDCe.getAddress();
      await expect(
        c.StopMarketOrder.connect(c.deployer).addOrder(
          marginAccountID, 
          addressTokenIn, 
          amountTokenIn, 
          addressTokenOut, 
          amountTokenOutMinimum, 
          targetPrice, 
          typeConditions, 
          useBorrow, 
          autoRepay
        )
      ).to.be.revertedWith("Oracle has no information about the token!");
    })

    it("It is forbidden to add new orders when the maximum value is reached to the specified account", async () => {
      await c.StopMarketOrder.connect(c.deployer).setMaximumMarginAccountOrders(0);
      expect(await c.StopMarketOrder.maximumMarginAccountOrders()).to.eq(ethers.parseUnits("0", 0));
      await expect(
        c.StopMarketOrder.connect(c.deployer).addOrder(
          marginAccountID, 
          addressTokenIn, 
          amountTokenIn, 
          addressTokenOut, 
          amountTokenOutMinimum, 
          targetPrice, 
          typeConditions, 
          useBorrow, 
          autoRepay
        )
      ).to.be.revertedWith("The limit of available orders for the marginAccountID user has been reached!");
    })

    it("It is forbidden to add new active orders when the maximum value is reached", async () => {
      await c.StopMarketOrder.connect(c.deployer).setMaximumActiveOrders(0);
      expect(await c.StopMarketOrder.maximumActiveOrders()).to.eq(ethers.parseUnits("0", 0));
      await expect(
        c.StopMarketOrder.connect(c.deployer).addOrder(
          marginAccountID, 
          addressTokenIn, 
          amountTokenIn, 
          addressTokenOut, 
          amountTokenOutMinimum, 
          targetPrice, 
          typeConditions, 
          useBorrow, 
          autoRepay
        )
      ).to.be.revertedWith("The limit of available active orders has been reached!");
    })

    it("It is forbidden to add new orders of undefined typeConditions values", async () => {
      typeConditions = ethers.parseUnits("2", 0);
      await expect(
        c.StopMarketOrder.connect(c.deployer).addOrder(
          marginAccountID, 
          addressTokenIn, 
          amountTokenIn, 
          addressTokenOut, 
          amountTokenOutMinimum, 
          targetPrice, 
          typeConditions, 
          useBorrow, 
          autoRepay
        )
      ).to.be.revertedWith("Undefined type of execution condition!");
    })

    it("It is forbidden to add new orders with the same token address", async () => {
      addressTokenIn = await c.WETH.getAddress();
      addressTokenOut = await c.WETH.getAddress();
      await expect(
        c.StopMarketOrder.connect(c.deployer).addOrder(
          marginAccountID, 
          addressTokenIn, 
          amountTokenIn, 
          addressTokenOut, 
          amountTokenOutMinimum, 
          targetPrice, 
          typeConditions, 
          useBorrow, 
          autoRepay
        )
      ).to.be.revertedWith("The addresses for the token exchange must not match!");
    })

    it("It is forbidden to add new orders with zero token exchange", async () => {
      amountTokenIn = ethers.parseUnits("0", 0);
      await expect(
        c.StopMarketOrder.connect(c.deployer).addOrder(
          marginAccountID, 
          addressTokenIn, 
          amountTokenIn, 
          addressTokenOut, 
          amountTokenOutMinimum, 
          targetPrice, 
          typeConditions, 
          useBorrow, 
          autoRepay
        )
      ).to.be.revertedWith("The number of tokens to be exchanged cannot be equal to 0!");
    })

    it("It is forbidden to add new orders with a targetPrice less than or equal to zero", async () => {
      targetPrice = ethers.parseUnits("0", 0);
      await expect(
        c.StopMarketOrder.connect(c.deployer).addOrder(
          marginAccountID, 
          addressTokenIn, 
          amountTokenIn, 
          addressTokenOut, 
          amountTokenOutMinimum, 
          targetPrice, 
          typeConditions, 
          useBorrow, 
          autoRepay
        )
      ).to.be.revertedWith("An order cannot be added with a target price equal to 0!");
    })

    it("Checking the possibility of adding an order not by the owner", async () => {
      const idOrder = ethers.parseUnits("0", 0);
      await expect(
        c.StopMarketOrder.connect(c.signers[1]).addOrder(
          marginAccountID, 
          addressTokenIn, 
          amountTokenIn, 
          addressTokenOut, 
          amountTokenOutMinimum, 
          targetPrice, 
          typeConditions, 
          useBorrow, 
          autoRepay
        )
      ).to.be.revertedWith("You are not the owner of the token");
    })

    it("Adding an order without receiving debt tokens", async () => {
      expect(await c.StopMarketOrder.marginAccountIDToAmountOrder(marginAccountID)).to.eq(ethers.parseUnits("0", 0));
      const idActiveOrder = ethers.parseUnits("1", 0);
      const idOrder = ethers.parseUnits("1", 0);
      useBorrow = ethers.parseUnits("0", 0);
      await c.StopMarketOrder.connect(c.deployer).addOrder(
        marginAccountID, 
        addressTokenIn, 
        amountTokenIn, 
        addressTokenOut, 
        amountTokenOutMinimum, 
        targetPrice, 
        typeConditions, 
        useBorrow, 
        autoRepay
      );
      expect(await c.StopMarketOrder.getAllOrdersLength()).to.eq(ethers.parseUnits("1", 0));
      expect(await c.StopMarketOrder.getActiveIdOrdersLength()).to.eq(ethers.parseUnits("1", 0));
      expect(await c.StopMarketOrder.getUserOrdersLength(marginAccountID)).to.eq(ethers.parseUnits("1", 0));
      targetPrice = ethers.parseUnits("2000", 8);
      await c.StopMarketOrder.connect(c.deployer).addOrder(
        marginAccountID, 
        addressTokenIn, 
        amountTokenIn, 
        addressTokenOut, 
        amountTokenOutMinimum, 
        targetPrice, 
        typeConditions, 
        useBorrow, 
        autoRepay
      );
      expect(await c.StopMarketOrder.getAllOrdersLength()).to.eq(ethers.parseUnits("2", 0));
      expect(await c.StopMarketOrder.getActiveIdOrdersLength()).to.eq(ethers.parseUnits("2", 0));
      expect(await c.StopMarketOrder.getUserOrdersLength(marginAccountID)).to.eq(ethers.parseUnits("2", 0));
      expect(await c.StopMarketOrder.marginAccountIDToAmountOrder(marginAccountID)).to.eq(ethers.parseUnits("2", 0));
      expect(await c.MarginTrading.getMarginAccountRatio.staticCall(marginAccountID)).to.eq(MaxUint256);
      expect(await c.StopMarketOrder.activeIdOrders(idActiveOrder)).to.eq(ethers.parseUnits("1", 0));
      const myFirstOrder = await c.StopMarketOrder.allOrders(ethers.parseUnits("0", 0));
      expect(myFirstOrder[5]).to.eq(ethers.parseUnits("2100", 8));
      const myOrder = await c.StopMarketOrder.allOrders(idOrder);
      expect(myOrder[0]).to.eq(marginAccountID);
      expect(myOrder[1]).to.eq(addressTokenIn);
      expect(myOrder[2]).to.eq(amountTokenIn);
      expect(myOrder[3]).to.eq(addressTokenOut);
      expect(myOrder[4]).to.eq(amountTokenOutMinimum);
      expect(myOrder[5]).to.eq(targetPrice);
      expect(myOrder[6]).to.eq(typeConditions);
      expect(myOrder[7]).to.eq(autoRepay);
    })

    it("Adding an order with the borrowing of tokens", async () => {
      const idOrder = ethers.parseUnits("0", 0);
      amountTokenIn = ethers.parseUnits("600", await c.USDC.decimals());
      await c.MarginAccountManager.connect(c.deployer).approve(await c.StopMarketOrder.getAddress(), marginAccountID);
      await c.StopMarketOrder.connect(c.deployer).addOrder(
        marginAccountID, 
        addressTokenIn, 
        amountTokenIn, 
        addressTokenOut, 
        amountTokenOutMinimum, 
        targetPrice, 
        typeConditions, 
        useBorrow, 
        autoRepay
      );
      expect(await c.MarginTrading.getMarginAccountRatio.staticCall(marginAccountID)).to.not.eq(MaxUint256);
      expect(await c.MarginAccount.getErc20ByContract(marginAccountID, addressTokenIn)).to.eq(amountTokenIn);
      const myOrder = await c.StopMarketOrder.allOrders(idOrder);
      expect(myOrder[0]).to.eq(marginAccountID);
      expect(myOrder[1]).to.eq(addressTokenIn);
      expect(myOrder[2]).to.eq(amountTokenIn);
      expect(myOrder[3]).to.eq(addressTokenOut);
      expect(myOrder[4]).to.eq(amountTokenOutMinimum);
      expect(myOrder[5]).to.eq(targetPrice);
      expect(myOrder[6]).to.eq(typeConditions);
      expect(myOrder[7]).to.eq(autoRepay);
    })
    
    it("Adding an order with the specified token borrowing, but the user's tokens are enough to fulfill the order (there will be no borrowing)", async () => {
      const idOrder = ethers.parseUnits("0", 0);
      const userBalanceBefore = await c.MarginAccount.getErc20ByContract(marginAccountID, addressTokenIn);
      amountTokenIn = ethers.parseUnits("400", await c.USDC.decimals());
      await c.StopMarketOrder.connect(c.deployer).addOrder(
        marginAccountID, 
        addressTokenIn, 
        amountTokenIn, 
        addressTokenOut, 
        amountTokenOutMinimum, 
        targetPrice, 
        typeConditions, 
        useBorrow, 
        autoRepay
      );
      expect(await c.MarginTrading.getMarginAccountRatio.staticCall(marginAccountID)).to.eq(MaxUint256);
      expect(await c.MarginAccount.getErc20ByContract(marginAccountID, addressTokenIn)).to.eq(userBalanceBefore);
      const myOrder = await c.StopMarketOrder.allOrders(idOrder);
      expect(myOrder[0]).to.eq(marginAccountID);
      expect(myOrder[1]).to.eq(addressTokenIn);
      expect(myOrder[2]).to.eq(amountTokenIn);
      expect(myOrder[3]).to.eq(addressTokenOut);
      expect(myOrder[4]).to.eq(amountTokenOutMinimum);
      expect(myOrder[5]).to.eq(targetPrice);
      expect(myOrder[6]).to.eq(typeConditions);
      expect(myOrder[7]).to.eq(autoRepay);
    })

  })

  describe("Check editOrder", async () => {
    let addressTokenIn: string
    let amountTokenIn: bigint
    let addressTokenOut: string
    let amountTokenOutMinimum: bigint
    let targetPrice: bigint
    let typeConditions: bigint
    let useBorrow: bigint
    let autoRepay: bigint
    let idOrder: bigint

    beforeEach("InitEdit", async () => {
      addressTokenIn = await c.USDC.getAddress();
      amountTokenIn = ethers.parseUnits("300", await c.USDC.decimals());
      addressTokenOut = await c.WETH.getAddress();
      amountTokenOutMinimum = ethers.parseUnits("0", 0);
      targetPrice = ethers.parseUnits("2100", 8);
      typeConditions = ethers.parseUnits("0", 0);
      useBorrow = ethers.parseUnits("1", 0);
      autoRepay = ethers.parseUnits("0", 0);
      await c.StopMarketOrder.connect(c.deployer).addOrder(
        marginAccountID, 
        addressTokenIn, 
        amountTokenIn, 
        addressTokenOut, 
        amountTokenOutMinimum, 
        targetPrice, 
        typeConditions, 
        useBorrow, 
        autoRepay
      );
      idOrder = ethers.parseUnits("0", 0);
    });

    it("It is forbidden to change the order with the indication of the amountTokenIn less than or equal to zero", async () => {
      amountTokenIn = ethers.parseUnits("0", 0);
      await expect(
        c.StopMarketOrder.connect(c.deployer).editOrder(
          idOrder, 
          amountTokenIn, 
          amountTokenOutMinimum, 
          targetPrice, 
          useBorrow, 
          autoRepay
        )
      ).to.be.revertedWith("The number of tokens to be exchanged cannot be equal to 0!");
    })

    it("It is forbidden to change the order with the indication of the targetPrice less than or equal to zero", async () => {
      targetPrice = ethers.parseUnits("0", 0);
      await expect(
        c.StopMarketOrder.connect(c.deployer).editOrder(
          idOrder, 
          amountTokenIn, 
          amountTokenOutMinimum, 
          targetPrice, 
          useBorrow, 
          autoRepay
        )
      ).to.be.revertedWith("The targetPrice cannot be equal to 0!");
    })

    it("Checking the possibility of changing the order not by the owner", async () => {
      amountTokenIn = ethers.parseUnits("400", await c.USDC.decimals());
      targetPrice = ethers.parseUnits("1800", 8);
      useBorrow = ethers.parseUnits("0", 0);
      await expect(
          c.StopMarketOrder.connect(c.signers[1]).editOrder(
          idOrder, 
          amountTokenIn, 
          amountTokenOutMinimum, 
          targetPrice, 
          useBorrow, 
          autoRepay
        )
      ).to.be.revertedWith("You are not the owner of the token");
    })

    it("Checking the possibility of changing the order by the owner without borrowing tokens", async () => {
      amountTokenIn = ethers.parseUnits("400", await c.USDC.decimals());
      amountTokenOutMinimum = ethers.parseUnits("1", 0);
      targetPrice = ethers.parseUnits("1800", 8);
      useBorrow = ethers.parseUnits("0", 0);
      autoRepay = ethers.parseUnits("1", 0);
      await c.StopMarketOrder.connect(c.deployer).editOrder(
        idOrder, 
        amountTokenIn, 
        amountTokenOutMinimum, 
        targetPrice, 
        useBorrow, 
        autoRepay
      );
      expect(await c.StopMarketOrder.getAllOrdersLength()).to.eq(ethers.parseUnits("1", 0));
      expect(await c.StopMarketOrder.getActiveIdOrdersLength()).to.eq(ethers.parseUnits("1", 0));
      expect(await c.StopMarketOrder.getUserOrdersLength(marginAccountID)).to.eq(ethers.parseUnits("1", 0));
      expect(await c.MarginTrading.getMarginAccountRatio.staticCall(marginAccountID)).to.eq(MaxUint256);
      const myOrder = await c.StopMarketOrder.allOrders(idOrder);
      expect(myOrder[0]).to.eq(marginAccountID);
      expect(myOrder[1]).to.eq(addressTokenIn);
      expect(myOrder[2]).to.eq(amountTokenIn);
      expect(myOrder[3]).to.eq(addressTokenOut);
      expect(myOrder[4]).to.eq(amountTokenOutMinimum);
      expect(myOrder[5]).to.eq(targetPrice);
      expect(myOrder[6]).to.eq(typeConditions);
      expect(myOrder[7]).to.eq(autoRepay);
    })

    it("If you specify a loan and an insufficient number of tokens on the account, the debt is taken", async () => {
      amountTokenIn = ethers.parseUnits("600", await c.USDC.decimals());
      targetPrice = ethers.parseUnits("1800", 8);
      useBorrow = ethers.parseUnits("1", 0);
      await c.MarginAccountManager.connect(c.deployer).approve(await c.StopMarketOrder.getAddress(), marginAccountID);
      await c.StopMarketOrder.connect(c.deployer).editOrder(
        idOrder, 
        amountTokenIn, 
        amountTokenOutMinimum, 
        targetPrice, 
        useBorrow, 
        autoRepay
      );
      expect(await c.MarginTrading.getMarginAccountRatio.staticCall(marginAccountID)).to.not.eq(MaxUint256);
      expect(await c.MarginAccount.getErc20ByContract(marginAccountID, addressTokenIn)).to.eq(amountTokenIn);
      const myOrder = await c.StopMarketOrder.allOrders(idOrder);
      expect(myOrder[0]).to.eq(marginAccountID);
      expect(myOrder[1]).to.eq(addressTokenIn);
      expect(myOrder[2]).to.eq(amountTokenIn);
      expect(myOrder[3]).to.eq(addressTokenOut);
      expect(myOrder[4]).to.eq(amountTokenOutMinimum);
      expect(myOrder[5]).to.eq(targetPrice);
      expect(myOrder[6]).to.eq(typeConditions);
      expect(myOrder[7]).to.eq(autoRepay);
    })
    
  })

  describe("Check deleteOrder", async () => {
    let addressTokenIn: string
    let amountTokenIn: bigint
    let addressTokenOut: string
    let amountTokenOutMinimum: bigint
    let targetPrice: bigint
    let typeConditions: bigint
    let useBorrow: bigint
    let autoRepay: bigint
    let activeOrderId: bigint

    beforeEach("InitDelete", async () => {
      addressTokenIn = await c.USDC.getAddress();
      amountTokenIn = ethers.parseUnits("300", await c.USDC.decimals());
      addressTokenOut = await c.WETH.getAddress();
      amountTokenOutMinimum = ethers.parseUnits("0", 0);
      targetPrice = ethers.parseUnits("2100", 8);
      typeConditions = ethers.parseUnits("0", 0);
      useBorrow = ethers.parseUnits("1", 0);
      autoRepay = ethers.parseUnits("0", 0);
      await c.StopMarketOrder.connect(c.deployer).addOrder(
        marginAccountID, 
        addressTokenIn, 
        amountTokenIn, 
        addressTokenOut, 
        amountTokenOutMinimum, 
        targetPrice, 
        typeConditions, 
        useBorrow, 
        autoRepay
      );
      targetPrice = ethers.parseUnits("1800", 8);
      await c.StopMarketOrder.connect(c.deployer).addOrder(
        marginAccountID, 
        addressTokenIn, 
        amountTokenIn, 
        addressTokenOut, 
        amountTokenOutMinimum, 
        targetPrice, 
        typeConditions, 
        useBorrow, 
        autoRepay
      );
      activeOrderId = ethers.parseUnits("1", 0);
    });

    it("The added order cannot be deleted by a non-owner", async () => {
      await expect(
        c.StopMarketOrder.connect(c.signers[1]).deleteOrder(
          activeOrderId
        )
      ).to.be.revertedWith("You are not the owner of the token");
    })

    it("The owner can delete the added order", async () => {
      activeOrderId = ethers.parseUnits("0", 0);
      expect(await c.StopMarketOrder.getAllOrdersLength()).to.eq(ethers.parseUnits("2", 0));
      expect(await c.StopMarketOrder.getActiveIdOrdersLength()).to.eq(ethers.parseUnits("2", 0));
      expect(await c.StopMarketOrder.getUserOrdersLength(marginAccountID)).to.eq(ethers.parseUnits("2", 0));
      await c.StopMarketOrder.connect(c.deployer).deleteOrder(activeOrderId);
      expect(await c.StopMarketOrder.getAllOrdersLength()).to.eq(ethers.parseUnits("2", 0));
      expect(await c.StopMarketOrder.getActiveIdOrdersLength()).to.eq(ethers.parseUnits("1", 0));
      expect(await c.StopMarketOrder.getUserOrdersLength(marginAccountID)).to.eq(ethers.parseUnits("2", 0));
      expect(await c.StopMarketOrder.marginAccountIDToAmountOrder(marginAccountID)).to.eq(ethers.parseUnits("1", 0));
      const idOrder = await c.StopMarketOrder.activeIdOrders(activeOrderId);
      expect(idOrder).to.eq(ethers.parseUnits("1", 0));
      const myOrder = await c.StopMarketOrder.allOrders(idOrder);
      expect(myOrder[0]).to.eq(marginAccountID);
      expect(myOrder[1]).to.eq(addressTokenIn);
      expect(myOrder[2]).to.eq(amountTokenIn);
      expect(myOrder[3]).to.eq(addressTokenOut);
      expect(myOrder[4]).to.eq(amountTokenOutMinimum);
      expect(myOrder[5]).to.eq(targetPrice);
      expect(myOrder[6]).to.eq(typeConditions);
      expect(myOrder[7]).to.eq(autoRepay);
      await c.StopMarketOrder.connect(c.deployer).deleteOrder(activeOrderId);
      expect(await c.StopMarketOrder.marginAccountIDToAmountOrder(marginAccountID)).to.eq(ethers.parseUnits("0", 0));
    })
    
  })

  describe("Check orderReachedTargetPrice", async () => {
    let addressTokenIn: string
    let amountTokenIn: bigint
    let addressTokenOut: string
    let amountTokenOutMinimum: bigint
    let targetPrice: bigint
    let typeConditions: bigint
    let useBorrow: bigint
    let autoRepay: bigint

    it("Checking typeConditions == 0", async () => {
      addressTokenIn = await c.USDC.getAddress();
      amountTokenIn = ethers.parseUnits("300", await c.USDC.decimals());
      addressTokenOut = await c.WETH.getAddress();
      amountTokenOutMinimum = ethers.parseUnits("0", 0);
      targetPrice = ethers.parseUnits("2100", 8);
      typeConditions = ethers.parseUnits("0", 0);
      useBorrow = ethers.parseUnits("1", 0);
      autoRepay = ethers.parseUnits("0", 0);
      await c.StopMarketOrder.connect(c.deployer).addOrder(
        marginAccountID, 
        addressTokenIn, 
        amountTokenIn, 
        addressTokenOut, 
        amountTokenOutMinimum, 
        targetPrice, 
        typeConditions, 
        useBorrow, 
        autoRepay
      );
      const idOrder = ethers.parseUnits("0", 0);
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2300", 8));
      const answer_1 = await c.StopMarketOrder.orderReachedTargetPrice.staticCall(idOrder);
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2100", 8));
      const answer_2 = await c.StopMarketOrder.orderReachedTargetPrice.staticCall(idOrder);
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2000", 8));
      const answer_3 = await c.StopMarketOrder.orderReachedTargetPrice.staticCall(idOrder);
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2600", 8));
      const answer_4 = await c.StopMarketOrder.orderReachedTargetPrice.staticCall(idOrder);
      expect(answer_1).to.eq(false);
      expect(answer_2).to.eq(true);
      expect(answer_3).to.eq(true);
      expect(answer_4).to.eq(false);
    })

    it("Checking typeConditions == 1", async () => {
      addressTokenIn = await c.USDC.getAddress();
      amountTokenIn = ethers.parseUnits("300", await c.USDC.decimals());
      addressTokenOut = await c.WETH.getAddress();
      amountTokenOutMinimum = ethers.parseUnits("0", 0);
      targetPrice = ethers.parseUnits("2100", 8);
      typeConditions = ethers.parseUnits("1", 0);
      useBorrow = ethers.parseUnits("1", 0);
      autoRepay = ethers.parseUnits("0", 0);
      await c.StopMarketOrder.connect(c.deployer).addOrder(
        marginAccountID, 
        addressTokenIn, 
        amountTokenIn, 
        addressTokenOut, 
        amountTokenOutMinimum, 
        targetPrice, 
        typeConditions, 
        useBorrow, 
        autoRepay
      );
      const idOrder = ethers.parseUnits("0", 0);
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("1800", 8));
      const answer_1 = await c.StopMarketOrder.orderReachedTargetPrice.staticCall(idOrder);
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2100", 8));
      const answer_2 = await c.StopMarketOrder.orderReachedTargetPrice.staticCall(idOrder);
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2600", 8));
      const answer_3 = await c.StopMarketOrder.orderReachedTargetPrice.staticCall(idOrder);
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2000", 8));
      const answer_4 = await c.StopMarketOrder.orderReachedTargetPrice.staticCall(idOrder);
      expect(answer_1).to.eq(false);
      expect(answer_2).to.eq(true);
      expect(answer_3).to.eq(true);
      expect(answer_4).to.eq(false);
    })
    
  })

  describe("Check availableOrderForExecution", async () => {
    let addressTokenIn: string
    let amountTokenIn: bigint
    let addressTokenOut: string
    let amountTokenOutMinimum: bigint
    let targetPrice: bigint
    let typeConditions: bigint
    let useBorrow: bigint
    let autoRepay: bigint
    let idOrder: bigint

    beforeEach("InitAvailableOrder", async () => {
      addressTokenIn = await c.USDC.getAddress();
      amountTokenIn = ethers.parseUnits("300", await c.USDC.decimals());
      addressTokenOut = await c.WETH.getAddress();
      amountTokenOutMinimum = ethers.parseUnits("0", 0);
      targetPrice = ethers.parseUnits("2100", 8);
      typeConditions = ethers.parseUnits("0", 0);
      useBorrow = ethers.parseUnits("0", 0);
      autoRepay = ethers.parseUnits("0", 0);
      await c.StopMarketOrder.connect(c.deployer).addOrder(
        marginAccountID, 
        addressTokenIn, 
        amountTokenIn, 
        addressTokenOut, 
        amountTokenOutMinimum, 
        targetPrice, 
        typeConditions, 
        useBorrow, 
        autoRepay
      );
      idOrder = ethers.parseUnits("0", 0);
    });

    it("We check the returned codes from cases of borrowing tokens (443, 444, 445)", async () => {
      amountTokenIn = ethers.parseUnits("6000000", 6);
      await c.StopMarketOrder.connect(c.deployer).editOrder(
        idOrder, 
        amountTokenIn, 
        amountTokenOutMinimum, 
        targetPrice, 
        useBorrow, 
        autoRepay
      );
      const answer_1 = await c.StopMarketOrder.availableOrderForExecution.staticCall(idOrder);
      expect(answer_1, "The error code is different from the expected one (443)").to.eq(ethers.parseUnits("443", 0));
      amountTokenIn = await c.USDC.balanceOf(c.USDC_LiquidityPool.getAddress()) * ethers.parseUnits("9", 0) / ethers.parseUnits("10", 0);
      await c.StopMarketOrder.connect(c.deployer).editOrder(
        idOrder, 
        amountTokenIn, 
        amountTokenOutMinimum, 
        targetPrice, 
        useBorrow, 
        autoRepay
      );
      const answer_2 = await c.StopMarketOrder.availableOrderForExecution.staticCall(idOrder);
      expect(answer_2, "The error code is different from the expected one (444)").to.eq(ethers.parseUnits("444", 0));
      amountTokenIn = USDCprovideAmount * ethers.parseUnits("9", 0);
      await c.StopMarketOrder.connect(c.deployer).editOrder(
        idOrder, 
        amountTokenIn, 
        amountTokenOutMinimum, 
        targetPrice, 
        useBorrow, 
        autoRepay
      );
      await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.USDC.getAddress(), USDCprovideAmount * ethers.parseUnits("7", 0));
      const newYellowCoeff = 1.30 * 1e5;
      await c.MarginTrading.connect(c.deployer).setYellowCoeff(newYellowCoeff);
      const answer_3 = await c.StopMarketOrder.availableOrderForExecution.staticCall(idOrder);
      expect(answer_3, "The error code is different from the expected one (445)").to.eq(ethers.parseUnits("445", 0));
    })

    it("We check the possibility of execution depending on the target price and typeConditions == 0", async () => {
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2300", 8));
      expect(await c.StopMarketOrder.availableOrderForExecution.staticCall(idOrder)).to.eq(ethers.parseUnits("0", 0));
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2100", 8));
      expect(await c.StopMarketOrder.availableOrderForExecution.staticCall(idOrder)).to.eq(ethers.parseUnits("1", 0));
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2000", 8));
      expect(await c.StopMarketOrder.availableOrderForExecution.staticCall(idOrder)).to.eq(ethers.parseUnits("1", 0));
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2600", 8));
      expect(await c.StopMarketOrder.availableOrderForExecution.staticCall(idOrder)).to.eq(ethers.parseUnits("0", 0));
    })

    it("We check the possibility of execution depending on the target price and typeConditions == 1", async () => {
      const activeOrderId = ethers.parseUnits("0", 0);
      await c.StopMarketOrder.connect(c.deployer).deleteOrder(activeOrderId);
      typeConditions = ethers.parseUnits("1", 0);
      await c.StopMarketOrder.connect(c.deployer).addOrder(
        marginAccountID, 
        addressTokenIn, 
        amountTokenIn, 
        addressTokenOut, 
        amountTokenOutMinimum, 
        targetPrice, 
        typeConditions, 
        useBorrow, 
        autoRepay
      );
      idOrder = ethers.parseUnits("1", 0);
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("1800", 8));
      expect(await c.StopMarketOrder.availableOrderForExecution.staticCall(idOrder)).to.eq(ethers.parseUnits("0", 0));
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2100", 8));
      expect(await c.StopMarketOrder.availableOrderForExecution.staticCall(idOrder)).to.eq(ethers.parseUnits("1", 0));
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2600", 8));
      expect(await c.StopMarketOrder.availableOrderForExecution.staticCall(idOrder)).to.eq(ethers.parseUnits("1", 0));
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2000", 8));
      expect(await c.StopMarketOrder.availableOrderForExecution.staticCall(idOrder)).to.eq(ethers.parseUnits("0", 0));
    })
    
  })

  describe("Check executeOrder", async () => {
    let addressTokenIn: string
    let amountTokenIn: bigint
    let addressTokenOut: string
    let amountTokenOutMinimum: bigint
    let targetPrice: bigint
    let typeConditions: bigint
    let useBorrow: bigint
    let autoRepay: bigint
    let idOrder: bigint
    let activeOrderId: bigint

    beforeEach("InitExecuteOrder", async () => {
      addressTokenIn = await c.USDC.getAddress();
      amountTokenIn = ethers.parseUnits("300", await c.USDC.decimals());
      addressTokenOut = await c.WETH.getAddress();
      amountTokenOutMinimum = ethers.parseUnits("0", 0);
      targetPrice = ethers.parseUnits("2100", 8);
      typeConditions = ethers.parseUnits("0", 0);
      useBorrow = ethers.parseUnits("0", 0);
      autoRepay = ethers.parseUnits("0", 0);
      await c.StopMarketOrder.connect(c.deployer).addOrder(
        marginAccountID, 
        addressTokenIn, 
        amountTokenIn, 
        addressTokenOut, 
        amountTokenOutMinimum, 
        targetPrice, 
        typeConditions, 
        useBorrow, 
        autoRepay
      );
      targetPrice = ethers.parseUnits("1800", 8);
      await c.StopMarketOrder.connect(c.deployer).addOrder(
        marginAccountID, 
        addressTokenIn, 
        amountTokenIn, 
        addressTokenOut, 
        amountTokenOutMinimum, 
        targetPrice, 
        typeConditions, 
        useBorrow, 
        autoRepay
      );
      idOrder = ethers.parseUnits("0", 0);
      activeOrderId = ethers.parseUnits("0", 0);
    });

    it("The order can be executed without borrowing and repayment of debt tokens", async () => {
      expect(await c.StopMarketOrder.marginAccountIDToAmountOrder(marginAccountID)).to.eq(ethers.parseUnits("2", 0));
      await c.MarginAccountManager.connect(c.deployer).approve(await c.StopMarketOrder.getAddress(), marginAccountID);
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2200", 8));
      expect(await c.StopMarketOrder.availableOrderForExecution.staticCall(idOrder)).to.eq(ethers.parseUnits("0", 0));
      await expect(
        c.StopMarketOrder.connect(c.signers[1]).executeOrder(activeOrderId)
      ).to.be.revertedWith("The order execution condition has not been reached!");
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2000", 8));
      expect(await c.StopMarketOrder.availableOrderForExecution.staticCall(idOrder)).to.eq(ethers.parseUnits("1", 0));
      await c.StopMarketOrder.connect(c.signers[1]).executeOrder(activeOrderId);
      const thisIdOrder = await c.StopMarketOrder.activeIdOrders(activeOrderId);
      expect(thisIdOrder).to.eq(ethers.parseUnits("1", 0));
      const myOrder = await c.StopMarketOrder.allOrders(thisIdOrder);
      expect(myOrder[0]).to.eq(marginAccountID);
      expect(myOrder[1]).to.eq(addressTokenIn);
      expect(myOrder[2]).to.eq(amountTokenIn);
      expect(myOrder[3]).to.eq(addressTokenOut);
      expect(myOrder[4]).to.eq(amountTokenOutMinimum);
      expect(myOrder[5]).to.eq(targetPrice);
      expect(myOrder[6]).to.eq(typeConditions);
      expect(myOrder[7]).to.eq(autoRepay);
      expect(await c.MarginAccount.getErc20ByContract(marginAccountID, c.USDC.getAddress())).to.eq(USDCprovideAmount - amountTokenIn);
      expect(await c.MarginTrading.getMarginAccountRatio.staticCall(marginAccountID)).to.eq(MaxUint256);
      expect(await c.StopMarketOrder.marginAccountIDToAmountOrder(marginAccountID)).to.eq(ethers.parseUnits("1", 0));
    })
    
    it("The order can be executed with borrowing and without repayment of debt tokens", async () => {
      expect(await c.StopMarketOrder.marginAccountIDToAmountOrder(marginAccountID)).to.eq(ethers.parseUnits("2", 0));
      await c.MarginAccountManager.connect(c.deployer).approve(await c.StopMarketOrder.getAddress(), marginAccountID);
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2200", 8));
      expect(await c.StopMarketOrder.availableOrderForExecution.staticCall(idOrder)).to.eq(ethers.parseUnits("0", 0));
      await expect(
        c.StopMarketOrder.connect(c.signers[1]).executeOrder(activeOrderId)
      ).to.be.revertedWith("The order execution condition has not been reached!");
      await c.StopMarketOrder.connect(c.deployer).editOrder(
        idOrder, 
        ethers.parseUnits("800", 6), 
        amountTokenOutMinimum, 
        ethers.parseUnits("2100", 8), 
        useBorrow, 
        autoRepay
      );
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2000", 8));
      expect(await c.StopMarketOrder.availableOrderForExecution.staticCall(idOrder)).to.eq(ethers.parseUnits("1", 0));
      await c.StopMarketOrder.connect(c.signers[1]).executeOrder(activeOrderId);
      const thisIdOrder = await c.StopMarketOrder.activeIdOrders(activeOrderId);
      expect(thisIdOrder).to.eq(ethers.parseUnits("1", 0));
      const myOrder = await c.StopMarketOrder.allOrders(thisIdOrder);
      expect(myOrder[0]).to.eq(marginAccountID);
      expect(myOrder[1]).to.eq(addressTokenIn);
      expect(myOrder[2]).to.eq(amountTokenIn);
      expect(myOrder[3]).to.eq(addressTokenOut);
      expect(myOrder[4]).to.eq(amountTokenOutMinimum);
      expect(myOrder[5]).to.eq(targetPrice);
      expect(myOrder[6]).to.eq(typeConditions);
      expect(myOrder[7]).to.eq(autoRepay);
      expect(await c.MarginAccount.getErc20ByContract(marginAccountID, c.USDC.getAddress())).to.eq(ethers.parseUnits("0", 0));
      expect(await c.MarginTrading.getMarginAccountRatio.staticCall(marginAccountID)).to.not.eq(MaxUint256);
      expect(await c.StopMarketOrder.marginAccountIDToAmountOrder(marginAccountID)).to.eq(ethers.parseUnits("1", 0));
    })

    it("The order can be executed without attracting borrowed funds and with the return of debt tokens", async () => {
      expect(await c.StopMarketOrder.marginAccountIDToAmountOrder(marginAccountID)).to.eq(ethers.parseUnits("2", 0));
      await c.MarginAccountManager.connect(c.deployer).approve(await c.StopMarketOrder.getAddress(), marginAccountID);
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2200", 8));
      expect(await c.StopMarketOrder.availableOrderForExecution.staticCall(idOrder)).to.eq(ethers.parseUnits("0", 0));
      await expect(
        c.StopMarketOrder.connect(c.signers[1]).executeOrder(activeOrderId)
      ).to.be.revertedWith("The order execution condition has not been reached!");
      await c.StopMarketOrder.connect(c.deployer).editOrder(
        idOrder, 
        amountTokenIn,
        amountTokenOutMinimum, 
        ethers.parseUnits("2100", 8), 
        useBorrow, 
        ethers.parseUnits("1", 0)
      );
      expect(await c.MarginAccount.getErc20ByContract(marginAccountID, c.WETH.getAddress())).to.eq(ethers.parseUnits("0", 0));
      await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.WETH.getAddress(), ethers.parseUnits("1", 16));
      expect(await c.MarginTrading.getMarginAccountRatio.staticCall(marginAccountID)).to.not.eq(MaxUint256);
      const userBalanceWETHBefore = await c.MarginAccount.getErc20ByContract(marginAccountID, c.WETH.getAddress());
      expect(userBalanceWETHBefore).to.eq(ethers.parseUnits("1", 16));
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2000", 8));
      expect(await c.StopMarketOrder.availableOrderForExecution.staticCall(idOrder)).to.eq(ethers.parseUnits("1", 0));
      await c.StopMarketOrder.connect(c.signers[1]).executeOrder(activeOrderId);
      const thisIdOrder = await c.StopMarketOrder.activeIdOrders(activeOrderId);
      expect(thisIdOrder).to.eq(ethers.parseUnits("1", 0));
      const myOrder = await c.StopMarketOrder.allOrders(thisIdOrder);
      expect(myOrder[0]).to.eq(marginAccountID);
      expect(myOrder[1]).to.eq(addressTokenIn);
      expect(myOrder[2]).to.eq(amountTokenIn);
      expect(myOrder[3]).to.eq(addressTokenOut);
      expect(myOrder[4]).to.eq(amountTokenOutMinimum);
      expect(myOrder[5]).to.eq(targetPrice);
      expect(myOrder[6]).to.eq(typeConditions);
      expect(myOrder[7]).to.eq(autoRepay);
      expect(await c.MarginAccount.getErc20ByContract(marginAccountID, c.USDC.getAddress())).to.eq(USDCprovideAmount - amountTokenIn);
      expect(await c.MarginTrading.getMarginAccountRatio.staticCall(marginAccountID)).to.eq(MaxUint256);
      expect(await c.StopMarketOrder.marginAccountIDToAmountOrder(marginAccountID)).to.eq(ethers.parseUnits("1", 0));
    })

  })

  describe("Check emitted events", function () {
    it("(AddNewOrder, EditActiveOrder, ExecutActiveOrder, DeleteActiveOrder)", async function () {
      
      let addressTokenIn = await c.USDC.getAddress();
      let amountTokenIn = ethers.parseUnits("300", await c.USDC.decimals());
      let addressTokenOut = await c.WETH.getAddress();
      let amountTokenOutMinimum = ethers.parseUnits("0", 0);
      let targetPrice = ethers.parseUnits("2100", 8);
      let typeConditions = ethers.parseUnits("0", 0);
      let useBorrow = ethers.parseUnits("0", 0);
      let autoRepay = ethers.parseUnits("0", 0);

      await expect(
        c.StopMarketOrder.connect(c.deployer).addOrder(
          marginAccountID, 
          addressTokenIn, 
          amountTokenIn, 
          addressTokenOut, 
          amountTokenOutMinimum, 
          targetPrice, 
          typeConditions, 
          useBorrow, 
          autoRepay
        )
      )
        .to.emit(c.StopMarketOrder, "AddNewOrder")
        .withArgs(
          marginAccountID, 
          addressTokenIn, 
          amountTokenIn, 
          addressTokenOut, 
          amountTokenOutMinimum, 
          targetPrice, 
          typeConditions,  
          autoRepay
        );
      
      let idOrder = ethers.parseUnits("0", 0);
      amountTokenIn = ethers.parseUnits("400", await c.USDC.decimals());
      amountTokenOutMinimum = ethers.parseUnits("1", 0);
      targetPrice = ethers.parseUnits("1800", 8);
      useBorrow = ethers.parseUnits("0", 0);
      autoRepay = ethers.parseUnits("1", 0);

      await expect(
        c.StopMarketOrder.connect(c.deployer).editOrder(
          idOrder, 
          amountTokenIn, 
          amountTokenOutMinimum, 
          targetPrice, 
          useBorrow, 
          autoRepay
        )
      )
        .to.emit(c.StopMarketOrder, "EditActiveOrder")
        .withArgs(
          marginAccountID, 
          addressTokenIn, 
          amountTokenIn, 
          addressTokenOut, 
          amountTokenOutMinimum, 
          targetPrice, 
          typeConditions,  
          autoRepay
        );

      let activeOrderId = ethers.parseUnits("0", 0);
      await expect(
        c.StopMarketOrder.connect(c.deployer).deleteOrder(activeOrderId)
      )
        .to.emit(c.StopMarketOrder, "DeleteActiveOrder")
        .withArgs(
          marginAccountID, 
          addressTokenIn, 
          amountTokenIn, 
          addressTokenOut, 
          amountTokenOutMinimum, 
          targetPrice, 
          typeConditions,  
          autoRepay
        );

      addressTokenIn = await c.USDC.getAddress();
      amountTokenIn = ethers.parseUnits("300", await c.USDC.decimals());
      addressTokenOut = await c.WETH.getAddress();
      amountTokenOutMinimum = ethers.parseUnits("0", 0);
      targetPrice = ethers.parseUnits("2100", 8);
      typeConditions = ethers.parseUnits("0", 0);
      useBorrow = ethers.parseUnits("0", 0);
      autoRepay = ethers.parseUnits("0", 0);
      await c.StopMarketOrder.connect(c.deployer).addOrder(
        marginAccountID, 
        addressTokenIn, 
        amountTokenIn, 
        addressTokenOut, 
        amountTokenOutMinimum, 
        targetPrice, 
        typeConditions, 
        useBorrow, 
        autoRepay
      );
      
      await c.MarginAccountManager.connect(c.deployer).approve(await c.StopMarketOrder.getAddress(), marginAccountID);
      await c.AggregatorV3_WETH_USDC.connect(c.deployer).setAnswer(ethers.parseUnits("2000", 8));

      await expect(
        c.StopMarketOrder.connect(c.signers[1]).executeOrder(activeOrderId)
      )
        .to.emit(c.StopMarketOrder, "ExecutActiveOrder")
        .withArgs(
          marginAccountID, 
          addressTokenIn, 
          amountTokenIn, 
          addressTokenOut, 
          amountTokenOutMinimum, 
          targetPrice, 
          typeConditions,  
          autoRepay
        );
    })
  })
  
})