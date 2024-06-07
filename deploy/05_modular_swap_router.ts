import {HardhatRuntimeEnvironment} from "hardhat/types"
import { keccak256, toUtf8Bytes } from "ethers"

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments, getNamedAccounts} = hre
  const { deploy, get, execute } = deployments
  const {deployer} = await getNamedAccounts()

  const MarginTrading = await get("MarginTrading")
  const MarginAccount = await get("MarginAccount")

  const MANAGER_ROLE = keccak256(toUtf8Bytes("MANAGER_ROLE"));
  const MARGIN_ACCOUNT_ROLE = keccak256(toUtf8Bytes("MARGIN_ACCOUNT_ROLE"));

  const ModularSwapRouter = await deploy("ModularSwapRouter", {
    from: deployer,
    log: true,
    args: [MarginTrading.address],
  })

  await execute(
    "ModularSwapRouter",
    {log: true, from: deployer},
    "grantRole",
    MANAGER_ROLE,
    deployer
  )

  await execute(
    "ModularSwapRouter",
    {log: true, from: deployer},
    "grantRole",
    MARGIN_ACCOUNT_ROLE,
    MarginAccount.address
  )

  await execute(
    "MarginAccount",
    {log: true, from: deployer},
    "setModularSwapRouter",
    ModularSwapRouter.address
  )

  await execute(
    "MarginTrading",
    {log: true, from: deployer},
    "setModularSwapRouter",
    ModularSwapRouter.address
  )
}

deployment.tags = ["modular_swap_router"]
deployment.dependencies = ["margin_account", "margin_trading"]

export default deployment
