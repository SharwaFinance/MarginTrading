import { expect } from "chai";
import { PreparationResult, preparationContracts } from "../utils/preparation"
import { keccak256, toUtf8Bytes, solidityPacked } from "ethers";

describe("modular_swap_router.spec.ts", function () {
  let c: PreparationResult

  beforeEach(async () => {
    c = await preparationContracts()
  })
  
  describe("AccessControl", async () => {
    let MANAGER_ROLE: string

    beforeEach("role preparation", async () => {
      MANAGER_ROLE = keccak256(toUtf8Bytes("MANAGER_ROLE"));
    })

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

  describe("UniswapModule: AccessControl", async () => {
    let MANAGER_ROLE: string

    beforeEach("role preparation", async () => {
      MANAGER_ROLE = keccak256(toUtf8Bytes("MANAGER_ROLE"));
    })

    it("setUniswapPath", async () => {
      const newPath = solidityPacked(["address", "uint24", "address"], [await c.WBTC.getAddress(), 3000, await c.WBTC.getAddress()])
      await c.UniswapModule_WETH_USDC.connect(c.deployer).setUniswapPath(newPath)
      await expect(
        c.UniswapModule_WETH_USDC.connect(c.signers[1]).setUniswapPath(newPath)
      ).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08") 
      expect(await c.UniswapModule_WETH_USDC.uniswapPath()).to.eq(newPath)
    })
  })
  
})