import { expect } from "chai";
import { parseUnits, ZeroAddress, keccak256, toUtf8Bytes } from "ethers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { PreparationResult, preparationContracts } from "../utils/prepareContracts"

describe("margin_trading.spec.ts", function () {
  let c: PreparationResult

  beforeEach(async () => {
    c = await preparationContracts()
  })

  it("User registration test", async () => {
    await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
    expect(await c.MarginAccountManager.ownerOf(0)).to.eq(await c.deployer.getAddress());
    await c.MarginAccountManager.connect(c.signers[1]).createMarginAccount()
    expect(await c.MarginAccountManager.ownerOf(1)).to.eq(await c.signers[1].getAddress());
  });

  it("isApprovedOrOwner", async () => {
    await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
    const sig0address = await c.signers[0].getAddress()
    const sig1address = await c.signers[1].getAddress()
    const sig2address = await c.signers[2].getAddress()
    const tokenID = 0
    expect(await c.MarginAccountManager.isApprovedOrOwner(sig0address, tokenID)).to.be.eq(true)
    expect(await c.MarginAccountManager.isApprovedOrOwner(sig1address, tokenID)).to.be.eq(false)
    await c.MarginAccountManager.connect(c.deployer).approve(sig1address, tokenID)
    expect(await c.MarginAccountManager.isApprovedOrOwner(sig0address, tokenID)).to.be.eq(true)
    expect(await c.MarginAccountManager.isApprovedOrOwner(sig1address, tokenID)).to.be.eq(true)
    
    await c.MarginAccountManager.connect(c.deployer).transferFrom(sig0address, sig2address, tokenID)
    expect(await c.MarginAccountManager.isApprovedOrOwner(sig0address, tokenID)).to.be.eq(false)
    expect(await c.MarginAccountManager.isApprovedOrOwner(sig1address, tokenID)).to.be.eq(false)
    expect(await c.MarginAccountManager.isApprovedOrOwner(sig2address, tokenID)).to.be.eq(true)    
  })

  it("test provideERC20 and withdrawERC20", async () => {
    await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
    let USDCprovideAmount = parseUnits("500", await c.USDC.decimals())
    await expect(
      c.MarginTrading.connect(c.deployer).provideERC20(0, await c.USDC.getAddress(), USDCprovideAmount)
    ).to.changeTokenBalances(
      c.USDC, 
      [await c.signers[0].getAddress(), await c.MarginAccount.getAddress()],  
      [-USDCprovideAmount, USDCprovideAmount]
    );
    expect(await c.MarginAccount.getErc20ByContract(0, await c.USDC.getAddress())).to.be.eq(USDCprovideAmount);
    await expect(
      c.MarginTrading.connect(c.deployer).withdrawERC20(0, await c.USDC.getAddress(), USDCprovideAmount)
    ).to.changeTokenBalances(
      c.USDC, 
      [await c.signers[0].getAddress(), await c.MarginAccount.getAddress()], 
      [USDCprovideAmount, -USDCprovideAmount]
    );
  });
  
  it("test provideERC20: invalid marginAccountID", async () => {
    await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
    let USDCprovideAmount = parseUnits("500", await c.USDC.decimals())
    await expect(
      c.MarginTrading.connect(c.signers[1]).provideERC20(0, await c.USDC.getAddress(), USDCprovideAmount)
    ).to.be.revertedWith("You are not the owner of the token") 
  })

  it("test provideERC20: invalid token", async () => {
    await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
    let USDCprovideAmount = parseUnits("500", await c.USDC.decimals())
    await expect(
      c.MarginTrading.connect(c.deployer).provideERC20(0, ZeroAddress, USDCprovideAmount)
    ).to.be.revertedWith("Token you are attempting to deposit is not available for deposit") 
  })

  it("test provideERC20: invalid amount", async () => {
    await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
    let USDCprovideAmount = parseUnits("500000000000000000", await c.USDC.decimals())
    await expect(
      c.MarginTrading.connect(c.deployer).provideERC20(0, await c.USDC.getAddress(), USDCprovideAmount)
    ).to.be.revertedWith("ERC20: insufficient allowance") 
  })

  it("test provideERC721 and withdrawERC721", async () => {
    await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
    const tokenID = 0
    const optionID = 0
    
    expect(await c.HegicPositionsManager.ownerOf(optionID)).to.be.eq(await c.deployer.getAddress())
    await c.MarginTrading.connect(c.deployer).provideERC721(tokenID, await c.HegicPositionsManager.getAddress(), optionID)
    expect(await c.HegicPositionsManager.ownerOf(optionID)).to.be.eq(await c.MarginAccount.getAddress())
    
    const arrERC721 = await c.MarginAccount.getErc721ByContract(tokenID, await c.HegicPositionsManager.getAddress()) 
    expect(arrERC721[0]).to.be.eq(BigInt(optionID));

    await c.MarginTrading.connect(c.deployer).withdrawERC721(tokenID, await c.HegicPositionsManager.getAddress(), optionID)
    expect(await c.HegicPositionsManager.ownerOf(optionID)).to.be.eq(await c.deployer.getAddress())
  });

  it("test provideERC721: invalid marginAccountID", async () => {
    await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
    const optionId = 0
    await expect(
      c.MarginTrading.connect(c.signers[1]).provideERC721(0, await c.HegicPositionsManager.getAddress(), optionId)
    ).to.be.revertedWith("You are not the owner of the token") 
  })

  it("test provideERC721: invalid token", async () => {
    await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
    const optionId = 0
    await expect(
      c.MarginTrading.connect(c.deployer).provideERC721(0, await c.MarginAccountManager.getAddress(), optionId)
    ).to.be.revertedWith("Token you are attempting to deposit is not available for deposit") 
  })

  it("test provideERC721: invalid optionId", async () => {
    await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
    const optionId = 1
    await expect(
      c.MarginTrading.connect(c.deployer).provideERC721(0, await c.HegicPositionsManager.getAddress(), optionId)
    ).to.be.revertedWith("Transfer not approved") 
  })

  describe("withdrawERC20", async () => {
    let USDCprovideAmount: bigint
    let marginAccountID: number

    beforeEach("provideERC20", async () => {
      await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
      USDCprovideAmount = parseUnits("500", await c.USDC.decimals())
      marginAccountID = 0
      await expect(
        c.MarginTrading.connect(c.deployer).provideERC20(0, await c.USDC.getAddress(), USDCprovideAmount)
      ).to.changeTokenBalances(
        c.USDC, 
        [await c.deployer.getAddress(), await c.MarginAccount.getAddress()], 
        [-USDCprovideAmount, USDCprovideAmount]
      );
      expect(await c.MarginAccount.getErc20ByContract(0, await c.USDC.getAddress())).to.be.eq(USDCprovideAmount);
    });

    it("withdrawERC20", async () => {
      await expect(
        c.MarginTrading.connect(c.deployer).withdrawERC20(0, await c.USDC.getAddress(),  USDCprovideAmount)
      ).to.changeTokenBalances(
        c.USDC, 
        [await c.deployer.getAddress(), await c.MarginAccount.getAddress()], 
        [USDCprovideAmount, -USDCprovideAmount]
      );
    });

    it("withdrawERC20: invalid marginAccountID", async () => {
      await expect(
        c.MarginTrading.connect(c.signers[1]).withdrawERC20( marginAccountID, await c.USDC.getAddress(), USDCprovideAmount)
      ).to.be.revertedWith("You are not the owner of the token") 
    });

    it("withdrawERC20: invalid token", async () => {
      await expect(
        c.MarginTrading.connect(c.deployer).withdrawERC20(marginAccountID, await c.USDCe.getAddress(), USDCprovideAmount)
      ).to.be.revertedWith("Insufficient token balance for withdrawal") 
    });

    it("withdrawERC20: invalid amount", async () => {
      USDCprovideAmount = parseUnits("500000000000000000", await c.USDC.decimals())
      await expect(
        c.MarginTrading.connect(c.deployer).withdrawERC20(marginAccountID, await c.USDC.getAddress(), USDCprovideAmount)
      ).to.be.revertedWith("Insufficient token balance for withdrawal") 
    });
  })

  describe("withdrawERC721", async () => {
    let optionId: number
    let marginAccountID: number

    beforeEach("provideERC721", async () => {
      await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
      optionId = 0
      marginAccountID = 0
      await expect(await c.HegicPositionsManager.ownerOf(optionId)).to.be.eq(await c.deployer.getAddress())
      await c.MarginTrading.connect(c.deployer).provideERC721(0, await c.HegicPositionsManager.getAddress(), optionId)
      await expect(await c.HegicPositionsManager.ownerOf(optionId)).to.be.eq(await c.MarginAccount.getAddress())
    });

    it("withdrawERC721", async () => {
      await c.MarginTrading.connect(c.deployer).withdrawERC721(marginAccountID,await c.HegicPositionsManager.getAddress(),optionId)
      await expect(await c.HegicPositionsManager.ownerOf(optionId)).to.be.eq(await c.deployer.getAddress())
    });

    it("withdrawERC721: invalid marginAccountID", async () => {
      await expect(
        c.MarginTrading.connect(c.signers[1]).withdrawERC721(marginAccountID,await c.HegicPositionsManager.getAddress(),optionId)
      ).to.be.revertedWith("You are not the owner of the token") 
    });

    it("withdrawERC721: invalid token", async () => {
      await expect(    
        c.MarginTrading.connect(c.deployer).withdrawERC721(marginAccountID,await c.MarginAccountManager.getAddress(),optionId)
      ).to.be.revertedWith("The ERC721 token you are attempting to withdraw is not available for withdrawal") 
    });

    it("withdrawERC721: invalid optionId", async () => {
      optionId = 1
      await expect(
        c.MarginTrading.connect(c.deployer).withdrawERC721(marginAccountID, await c.HegicPositionsManager.getAddress(), optionId)
      ).to.be.revertedWith("The ERC721 token you are attempting to withdraw is not available for withdrawal") 
    });
  })

  describe("borrow", async () => {
    let USDCprovideAmount: bigint
    let loanAmount: bigint
    let marginAccountID: number

    beforeEach("provideERC20", async () => {
      await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
      USDCprovideAmount = parseUnits("500", await c.USDC.decimals())
      loanAmount = USDCprovideAmount * BigInt(9)
      marginAccountID = 0
      await expect(
        c.MarginTrading.connect(c.deployer).provideERC20(0, await c.USDC.getAddress(), USDCprovideAmount)
      ).to.changeTokenBalances(
        c.USDC, 
        [await c.deployer.getAddress(), await c.MarginAccount.getAddress()], 
        [-USDCprovideAmount, USDCprovideAmount]
      );
      expect(await c.MarginAccount.getErc20ByContract(0, await c.USDC.getAddress())).to.be.eq(USDCprovideAmount);
    });
   
    it("borrow", async () => {
      await expect(
        c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.USDC.getAddress(), loanAmount)
      ).to.changeTokenBalances(
        c.USDC, 
        [await c.USDC_LiquidityPool.getAddress(), await c.MarginAccount.getAddress()], 
        [-loanAmount, loanAmount]
      )
      await expect(await c.USDC_LiquidityPool.getDebtWithAccruedInterest(marginAccountID)).to.be.eq(loanAmount);
      await expect(
        await c.MarginAccount.getErc20ByContract(marginAccountID, await c.USDC.getAddress())
      ).to.be.eq(USDCprovideAmount + loanAmount);
      const PortfolioRatio = BigInt(111111)
      await expect(
        await c.MarginTrading.getMarginAccountRatio.staticCall(marginAccountID)
      ).to.be.eq(PortfolioRatio)
    });

    it("borrow: invalid marginAccountID", async () => {
      marginAccountID = 1
      await expect(
        c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.USDC.getAddress(), loanAmount)
      ).to.be.revertedWith("ERC721: invalid token ID") 
    });

    it("borrow: invalid token", async () => {
      await expect(
        c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.USDCe.getAddress(), loanAmount)
      ).to.be.revertedWith("Token is not supported") 
    });

    it("borrow: invalid amount", async () => {
      loanAmount = USDCprovideAmount * BigInt(11)
      await expect(
        c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.USDC.getAddress(), loanAmount)
      ).to.be.revertedWith("Cannot borrow more; margin account ratio is too high") 
    });
  })

  describe("repay", async () => {
    let USDCprovideAmount: bigint
    let loanAmount: bigint
    let marginAccountID: number

    beforeEach("borrow", async () => {
      await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
      USDCprovideAmount = parseUnits("500", await c.USDC.decimals())
      loanAmount = USDCprovideAmount * BigInt(9)
      marginAccountID = 0
      await c.MarginTrading.connect(c.deployer).provideERC20(0, await c.USDC.getAddress(), USDCprovideAmount)
      await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.USDC.getAddress(), loanAmount)
    });

    it("repay", async () => {
      const accruedInterest = await c.USDC_LiquidityPool.getDebtWithAccruedInterestOnTime(marginAccountID, await time.latest() + 1) - loanAmount
      await expect(
        c.MarginTrading.connect(c.deployer).repay(marginAccountID, await c.USDC.getAddress(), 0)
      ).to.changeTokenBalances(
        c.USDC, 
        [await c.MarginAccount.getAddress(), await c.USDC_LiquidityPool.getAddress()], 
        [-(loanAmount + accruedInterest), loanAmount + accruedInterest]
      ) 

      await expect(
        await c.USDC_LiquidityPool.getDebtWithAccruedInterest(marginAccountID)
      ).to.be.eq(BigInt(0));
      
      await expect(
        await c.MarginAccount.getErc20ByContract(marginAccountID, await c.USDC.getAddress())
      ).to.be.eq(USDCprovideAmount - accruedInterest);
      
      const PortfolioRatio = BigInt(0)
      await expect(
        await c.MarginTrading.getMarginAccountRatio.staticCall(marginAccountID)
      ).to.be.eq(PortfolioRatio)
    });

    it("repay: invalid marginAccountID", async () => {
      marginAccountID = 1
      await expect(
        c.MarginTrading.connect(c.deployer).repay(marginAccountID, await c.USDC.getAddress(), loanAmount)
      ).to.be.revertedWith("ERC721: invalid token ID") 
    });

    it("repay: invalid token", async () => {
      await expect(
        c.MarginTrading.connect(c.deployer).repay(marginAccountID, await c.USDCe.getAddress(), loanAmount)
      ).to.be.revertedWith("Token is not supported") 
    });

    it("repay: invalid amount", async () => {
      const accruedInterest = await c.USDC_LiquidityPool.getDebtWithAccruedInterestOnTime(marginAccountID, await time.latest() + 1) - loanAmount
      await expect(
        c.MarginTrading.connect(c.deployer).repay(marginAccountID, await c.USDC.getAddress(), loanAmount + USDCprovideAmount)
      ).to.changeTokenBalances(
        c.USDC, 
        [await c.MarginAccount.getAddress(), await c.USDC_LiquidityPool.getAddress()], 
        [-(loanAmount + accruedInterest), loanAmount + accruedInterest]
      ) 
    });
  })

  describe("swap", async () => {
    let USDCprovideAmount: bigint
    let loanAmount: bigint
    let marginAccountID: number

    beforeEach("provideERC20 -> borrow", async () => {
      await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
      USDCprovideAmount = parseUnits("500", await c.USDC.decimals())
      loanAmount = USDCprovideAmount * BigInt(9)
      marginAccountID = 0
      await c.MarginTrading.connect(c.deployer).provideERC20(0, await c.USDC.getAddress(), USDCprovideAmount)
      await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.USDC.getAddress(), loanAmount)
    });

    it("swap", async () => {
      const USDC_balanceBeforeSwap = await c.MarginAccount.getErc20ByContract(marginAccountID, await c.USDC.getAddress())
      const loanAmountInWETH = await c.ModularSwapRouter.calculateAmountOutERC20.staticCall(await c.USDC.getAddress(), await c.WETH.getAddress(), loanAmount)
      const PortfolioValueBeforeSwap = await c.MarginTrading.calculateMarginAccountValue.staticCall(marginAccountID)
      await c.MarginTrading.connect(c.deployer).swap(marginAccountID, await c.USDC.getAddress(), await c.WETH.getAddress(), loanAmount, 0)
      await expect(await c.USDC.balanceOf(await c.MarginAccount.getAddress())).to.be.eq(USDC_balanceBeforeSwap-loanAmount)
      await expect(await c.WETH.balanceOf(await c.MarginAccount.getAddress())).to.be.eq(loanAmountInWETH)
      const PortfolioValueAfterSwap = await c.MarginTrading.calculateMarginAccountValue.staticCall(marginAccountID)
      await expect(PortfolioValueBeforeSwap).to.be.eq(PortfolioValueAfterSwap)
    });

    it("swap: invalid marginAccountID", async () => {
      marginAccountID = 1
      await expect(
        c.MarginTrading.connect(c.deployer).swap(marginAccountID, await c.USDC.getAddress(), await c.WETH.getAddress(), loanAmount, 0)
      ).to.be.revertedWith("ERC721: invalid token ID") 
    });

    it("swap: invalid tokenIn", async () => {
      await expect(
        c.MarginTrading.connect(c.deployer).swap(marginAccountID, await c.USDCe.getAddress(), await c.WETH.getAddress(), loanAmount, 0)
      ).to.be.revertedWith("Token is not available") 
    });

    it("swap: invalid tokenOut", async () => {
      await expect(
        c.MarginTrading.connect(c.deployer).swap(marginAccountID, await c.USDC.getAddress(), await c.USDCe.getAddress(), loanAmount, 0)
      ).to.be.revertedWith("Token is not available") 
    });

    it("swap: invalid amount", async () => {
      await expect(
        c.MarginTrading.connect(c.deployer).swap(marginAccountID, await c.USDC.getAddress(), await c.WETH.getAddress(), loanAmount * BigInt(2), 0)
      ).to.be.revertedWith("Insufficient funds for the swap") 
    });
  })

  describe("liquidate", async () => {
    let USDCprovideAmount: bigint
    let WETHprovideAmount: bigint
    let loanAmount: bigint
    let marginAccountID: number

    beforeEach("provideERC20 -> borrow", async () => {
      await c.MarginAccountManager.connect(c.deployer).createMarginAccount()
      USDCprovideAmount = parseUnits("4000", await c.USDC.decimals())
      WETHprovideAmount = parseUnits("1", await c.WETH.decimals())
      // c.WETH price = 4,000$
      // c.WBTC price = 60,000$
      loanAmount = WETHprovideAmount * BigInt(10)
      marginAccountID = 0
      await c.MarginTrading.connect(c.deployer).provideERC20(0, await c.WETH.getAddress(), WETHprovideAmount)
      await c.MarginTrading.connect(c.deployer).borrow(marginAccountID, await c.WETH.getAddress(), loanAmount)
    });

    it("liquidate check PortfolioRatio", async () => {
      const changePrice1 = parseUnits("3500", await c.USDC.decimals())
      await c.QuoterMock.setSwapPrice(await c.WETH.getAddress(), await c.USDC.getAddress(), changePrice1)

      let portfolioValueSwap = await c.MarginTrading.calculateMarginAccountValue.staticCall(marginAccountID)
      let accruedInterest = await c.WETH_LiquidityPool.getDebtWithAccruedInterestOnTime(marginAccountID, await time.latest() + 1) - WETHprovideAmount
      let debtWithAccruedInterest = (accruedInterest+WETHprovideAmount)*(changePrice1*BigInt(10**12))/BigInt(10**30)
      expect(
        await c.MarginTrading.getMarginAccountRatio.staticCall(marginAccountID)
      ).to.be.eq(portfolioValueSwap*BigInt(1e5)/debtWithAccruedInterest)

      const changePrice2 = parseUnits("4000", await c.USDC.decimals())
      await c.QuoterMock.setSwapPrice(await c.WETH.getAddress(), await c.USDC.getAddress(), changePrice2)

      await c.MarginTrading.connect(c.deployer).swap(marginAccountID, await c.WETH.getAddress(), await c.WBTC.getAddress(), loanAmount, 0)
      await c.QuoterMock.setSwapPrice(await c.WBTC.getAddress(), await c.USDC.getAddress(), parseUnits("54000", await c.USDC.decimals()))
      
      portfolioValueSwap = await c.MarginTrading.calculateMarginAccountValue.staticCall(marginAccountID)
      accruedInterest = await c.WETH_LiquidityPool.getDebtWithAccruedInterestOnTime(marginAccountID, await time.latest() + 1) - WETHprovideAmount
      debtWithAccruedInterest = (accruedInterest+WETHprovideAmount)*(changePrice2*BigInt(10**12))/BigInt(10**30)
      expect(
        await c.MarginTrading.getMarginAccountRatio.staticCall(marginAccountID)
      ).to.be.eq(portfolioValueSwap*BigInt(1e5)/debtWithAccruedInterest)
    })

    it("liquidate error", async () => {
      await expect(
        c.MarginTrading.liquidate(marginAccountID)
      ).to.be.revertedWith("Margin Account ratio is too high to execute liquidation") 
    })

    it("liquidate", async () => {
      await c.MarginTrading.connect(c.deployer).swap(marginAccountID, await c.WETH.getAddress(), await c.WBTC.getAddress(), loanAmount, 0)
      await c.QuoterMock.setSwapPrice(await c.WBTC.getAddress(), await c.USDC.getAddress(), parseUnits("56000", await c.USDC.decimals()))
      await c.MarginTrading.liquidate(marginAccountID)
      expect(
        await c.MarginTrading.getMarginAccountRatio.staticCall(marginAccountID)
      ).to.be.eq(BigInt(0))
    })

    it("liquidate insurancePool", async () => {
      await c.MarginTrading.connect(c.deployer).swap(marginAccountID, await c.WETH.getAddress(), await c.WBTC.getAddress(), loanAmount, 0)
      await c.QuoterMock.setSwapPrice(await c.WBTC.getAddress(), await c.USDC.getAddress(), parseUnits("50000", await c.USDC.decimals()))
      expect(
        await c.MarginTrading.calculateDebtWithAccruedInterest.staticCall(marginAccountID)
      ).to.be.greaterThan(
        await c.MarginTrading.calculateMarginAccountValue.staticCall(marginAccountID)
      )
      await c.MarginTrading.liquidate(marginAccountID)
      expect(
        await c.MarginTrading.calculateDebtWithAccruedInterest.staticCall(marginAccountID)
      ).to.be.eq(BigInt(0))
    })
  })

  describe("AccessControl", async () => {
    it("setModularSwapRouter", async () => {
      await c.MarginTrading.connect(c.deployer).setModularSwapRouter(ZeroAddress)
      await expect(
        c.MarginTrading.connect(c.signers[1]).setModularSwapRouter(ZeroAddress)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08") 
      expect(await c.MarginTrading.modularSwapRouter()).to.eq(ZeroAddress)
    })

    it("setRedCoeff", async () => {
      const newRedCoeff = 111e3
      await c.MarginTrading.connect(c.deployer).setRedCoeff(newRedCoeff)
      await expect(
        c.MarginTrading.connect(c.signers[1]).setRedCoeff(newRedCoeff)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08") 
      expect(await c.MarginTrading.redCoeff()).to.eq(newRedCoeff)
    })

    it("setYellowCoef", async () => {
      const newYellowCoef = 111e3
      await c.MarginTrading.connect(c.deployer).setYellowCoeff(newYellowCoef)
      await expect(
        c.MarginTrading.connect(c.signers[1]).setYellowCoeff(newYellowCoef)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08") 
      expect(await c.MarginTrading.yellowCoeff()).to.eq(newYellowCoef)
    })
  })
  
})