import {HardhatRuntimeEnvironment} from "hardhat/types"
import {solidityPacked, keccak256, toUtf8Bytes, MaxUint256, ZeroAddress} from "ethers"

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
  const MANAGER_ROLE = keccak256(toUtf8Bytes("MANAGER_ROLE"));

  const assetExchangerUSDCetoUSDC = await deploy("USDCe_USDC_UniswapModule", {
    contract: "UniswapModuleWithoutChainlink",
    from: deployer,
    log: true,
    args: [
      MarginAccount.address,
      USDCe.address,
      500,
      USDC.address,
      SwapRouter.address,
      Quoter.address
    ],
  })

  const HegicModule = await deploy("HegicModule", {
    from: deployer,
    log: true,
    args: [
      USDCe.address,
      HegicPositionsManager.address,
      OperationalTreasury.address,
      assetExchangerUSDCetoUSDC.address,
      MarginAccount.address
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
    "USDCe_USDC_UniswapModule",
    {log: true, from: deployer},
    "grantRole",
    MANAGER_ROLE,
    deployer
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
    "ModularSwapRouter",
    {log: true, from: deployer},
    "setAvailebleStrategy",
    ZeroAddress,
    true
  )

  await execute(
    "HegicModule",
    {log: true, from: deployer},
    "grantRole",
    MODULAR_SWAP_ROUTER_ROLE,
    ModularSwapRouter.address
  )

  await execute(
    "USDCe_USDC_UniswapModule",
    {log: true, from: deployer},
    "allApprove"
  )

  await execute(
    "MarginAccount",
    {log: true, from: deployer},
    "approveERC20",
    USDCe.address, 
    assetExchangerUSDCetoUSDC.address,
    MaxUint256
  )

  await execute(
    "MarginAccount",
    {log: true, from: deployer},
    "approveERC721ForAll",
    HegicPositionsManager.address, 
    HegicModule.address,
    true
  )

  
}

deployment.tags = ["hegic_module"]
deployment.dependencies = ["preparation", "margin_account", "liquidity_pool", "modular_swap_router", "uniswap_module"]

export default deployment
