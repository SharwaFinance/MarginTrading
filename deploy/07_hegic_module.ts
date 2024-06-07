import {HardhatRuntimeEnvironment} from "hardhat/types"
import {solidityPacked, keccak256, toUtf8Bytes} from "ethers"

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments, getNamedAccounts} = hre
  const { deploy, get, execute } = deployments
  const {deployer} = await getNamedAccounts()

  const MarginAccount = await get("MarginAccount")
  const HegicPositionsManager = await get("HegicPositionsManager")
  const ModularSwapRouter = await get("ModularSwapRouter")
  const OperationalTreasury = await get("OperationalTreasury")
  const SwapRouter = await get("SwapRouter")
  const Quoter = await get("Quoter")
  const USDCe = await get("USDCe")
  const USDC = await get("USDC")

  const MODULAR_SWAP_ROUTER_ROLE = keccak256(toUtf8Bytes("MODULAR_SWAP_ROUTER_ROLE"));

  const assetExchangerUSDCetoUSDC = await deploy("USDCe_USDC_UniswapModule", {
    contract: "UniswapModule",
    from: deployer,
    log: true,
    args: [
      MarginAccount.address,
      USDCe.address,
      USDC.address,
      SwapRouter.address,
      Quoter.address,
      solidityPacked(["address", "uint24", "address"], [USDCe.address, 3000, USDC.address])
    ],
  })

  const HegicModule = await deploy("HegicModule", {
    from: deployer,
    log: true,
    args: [
      USDCe.address,
      OperationalTreasury.address,
      assetExchangerUSDCetoUSDC.address,
      HegicPositionsManager.address
    ],
  })

  await execute(
    "USDCe_USDC_UniswapModule",
    {log: true, from: deployer},
    "grantRole",
    MODULAR_SWAP_ROUTER_ROLE,
    HegicModule.address
  )

  await execute(
    "ModularSwapRouter",
    {log: true, from: deployer},
    "setTokenInToTokenOutToExchange",
    HegicPositionsManager.address,
    USDC.address,
    HegicModule.address
  )

  await execute(
    "HegicModule",
    {log: true, from: deployer},
    "grantRole",
    MODULAR_SWAP_ROUTER_ROLE,
    ModularSwapRouter.address
  )
}

deployment.tags = ["hegic_module"]
deployment.dependencies = ["preparation", "margin_account", "liquidity_pool", "modular_swap_router", "uniswap_module"]

export default deployment
