import {HardhatRuntimeEnvironment} from "hardhat/types"
import {keccak256, toUtf8Bytes} from "ethers"

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments, getNamedAccounts} = hre
  const { deploy, get, execute } = deployments
  const {deployer} = await getNamedAccounts()

  const MarginTrading = await get("MarginTrading")

  const LIQUIDATOR_ROLE = keccak256(toUtf8Bytes("LIQUIDATOR_ROLE"));

  const UpkeepOfLiquidations = await deploy("UpkeepOfLiquidations", {
    from: deployer,
    log: true,
    args: [
      MarginTrading.address
    ],
  })

  await execute(
    "MarginTrading",
    {log: true, from: deployer},
    "grantRole",
    LIQUIDATOR_ROLE,
    UpkeepOfLiquidations.address
  )
}

deployment.tags = ["upkeep_liquidations"]
deployment.dependencies = ["margin_trading"]

export default deployment
