import { expect } from "chai";
import { PreparationResult, preparationContracts } from "../utils/preparation"
import { ZeroAddress, keccak256, toUtf8Bytes } from "ethers";

describe("margin_account.spec.ts", function () {
  let c: PreparationResult

  beforeEach(async () => {
    c = await preparationContracts()
  })
  
  describe("AccessControl", async () => {
    let MANAGER_ROLE: string

    beforeEach("role preparation", async () => {
      MANAGER_ROLE = keccak256(toUtf8Bytes("MANAGER_ROLE"));
    })

    it("setModularSwapRouter", async () => {
      await c.MarginAccount.connect(c.deployer).setModularSwapRouter(ZeroAddress)
      await expect(
        c.MarginAccount.connect(c.signers[1]).setModularSwapRouter(ZeroAddress)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08") 
      expect(await c.MarginAccount.modularSwapRouter()).to.eq(ZeroAddress)
    })

    it("setTokenToLiquidityPool", async () => {
      const newTokenAddress = await c.USDCe.getAddress()
      const newLiquidityPoolAddress = await c.signers[1].getAddress()
      await c.MarginAccount.connect(c.deployer).setTokenToLiquidityPool(newTokenAddress, newLiquidityPoolAddress)
      await expect(
        c.MarginAccount.connect(c.signers[1]).setTokenToLiquidityPool(newTokenAddress, newLiquidityPoolAddress)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08") 
      expect(await c.MarginAccount.tokenToLiquidityPool(newTokenAddress)).to.eq(newLiquidityPoolAddress)
      await c.MarginAccount.connect(c.deployer).setTokenToLiquidityPool(newTokenAddress, ZeroAddress)
      expect(await c.MarginAccount.tokenToLiquidityPool(newTokenAddress)).to.eq(ZeroAddress)
    })

    it("setAvailableTokenToLiquidityPool", async () => {
      const arrTokens = [await c.USDCe.getAddress(), await c.signers[1].getAddress()]
      await c.MarginAccount.connect(c.deployer).setAvailableTokenToLiquidityPool(arrTokens)
      await expect(
        c.MarginAccount.connect(c.signers[1]).setAvailableTokenToLiquidityPool(arrTokens)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08") 

      let availableTokenToLiquidityPool = await c.MarginAccount.getAvailableTokenToLiquidityPool()
      for (let i=0; i < arrTokens.length; i++) {
        expect(arrTokens[i]).to.eq(availableTokenToLiquidityPool[i])
      }

      await c.MarginAccount.connect(c.deployer).setAvailableTokenToLiquidityPool([])
      expect(await c.MarginAccount.getAvailableTokenToLiquidityPool()).to.be.empty
    })

    it("setAvailableErc20", async () => {
      const newAvailableErc20 = [await c.USDCe.getAddress(), await c.signers[1].getAddress()]
      await c.MarginAccount.connect(c.deployer).setAvailableErc20(newAvailableErc20)
      await expect(
        c.MarginAccount.connect(c.signers[1]).setAvailableErc20(newAvailableErc20)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08") 
      const arrAvailableErc20 = await c.MarginAccount.getAvailableErc20()
      expect(arrAvailableErc20[0]).to.eq(newAvailableErc20[0])
      expect(arrAvailableErc20[1]).to.eq(newAvailableErc20[1])
    })

    it("setIsAvailableErc20", async () => {
      const newTokenAddress = await c.USDCe.getAddress()
      await c.MarginAccount.connect(c.deployer).setIsAvailableErc20(newTokenAddress, true)
      await expect(
        c.MarginAccount.connect(c.signers[1]).setIsAvailableErc20(newTokenAddress, true)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08") 
      expect(await c.MarginAccount.isAvailableErc20(newTokenAddress)).to.eq(true)
      await c.MarginAccount.connect(c.deployer).setIsAvailableErc20(newTokenAddress, false)
      expect(await c.MarginAccount.isAvailableErc20(newTokenAddress)).to.eq(false)
    })

    it("setAvailableErc721", async () => {
      const newAvailableErc721 = [await c.USDCe.getAddress(), await c.signers[1].getAddress()]
      await c.MarginAccount.connect(c.deployer).setAvailableErc721(newAvailableErc721)
      await expect(
        c.MarginAccount.connect(c.signers[1]).setAvailableErc721(newAvailableErc721)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08") 
      const arrAvailableErc721 = await c.MarginAccount.getAvailableErc721()
      expect(arrAvailableErc721[0]).to.eq(newAvailableErc721[0])
      expect(arrAvailableErc721[1]).to.eq(newAvailableErc721[1])
    })

    it("setIsAvailableErc721", async () => {
      const newTokenAddress = await c.USDCe.getAddress()
      await c.MarginAccount.connect(c.deployer).setIsAvailableErc721(newTokenAddress, true)
      await expect(
        c.MarginAccount.connect(c.signers[1]).setIsAvailableErc721(newTokenAddress, true)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08") 
      expect(await c.MarginAccount.isAvailableErc721(newTokenAddress)).to.eq(true)
      await c.MarginAccount.connect(c.deployer).setIsAvailableErc721(newTokenAddress, false)
      expect(await c.MarginAccount.isAvailableErc721(newTokenAddress)).to.eq(false)
    })

    it("approveERC20", async () => {
      const newValue = 111e3
      await c.MarginAccount.connect(c.deployer).approveERC20(await c.USDCe.getAddress(), await c.signers[1].getAddress(), newValue)
      await expect(
        c.MarginAccount.connect(c.signers[1]).approveERC20(await c.USDCe.getAddress(), await c.signers[1].getAddress(), newValue)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08") 
      expect(await c.USDCe.allowance(await c.MarginAccount.getAddress(), await c.signers[1].getAddress())).to.be.eq(newValue)
      await c.MarginAccount.connect(c.deployer).approveERC20(await c.USDCe.getAddress(), await c.signers[1].getAddress(), 0)
      expect(await c.USDCe.allowance(await c.MarginAccount.getAddress(), await c.signers[1].getAddress())).to.be.eq(0)
    })
    
  })
  
})