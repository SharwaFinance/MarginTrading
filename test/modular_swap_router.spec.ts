import { expect } from "chai";
import { PreparationResult, prepareContracts } from "../utils/prepareContracts"
import { keccak256, toUtf8Bytes, solidityPacked } from "ethers";

describe("modular_swap_router.spec.ts", function () {
  let c: PreparationResult

  beforeEach(async () => {
    c = await prepareContracts()
  })
  
  describe("AccessControl", async () => {

    it("setTokenInToTokenOutToExchange", async () => {
      const newTokenIn = await c.USDCe.getAddress()
      const newTokenOut = await c.USDCe.getAddress()
      const newModule = await c.signers[1].getAddress()
      await c.ModularSwapRouter.connect(c.deployer).setTokenInToTokenOutToExchange(newTokenIn, newTokenOut, newModule)
      await expect(
        c.ModularSwapRouter.connect(c.signers[1]).setTokenInToTokenOutToExchange(newTokenIn, newTokenOut, newModule)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08") 
      expect(await c.ModularSwapRouter.getModuleAddress(newTokenIn, newTokenOut)).to.eq(newModule)
    })
  })
})