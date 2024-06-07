import {HardhatRuntimeEnvironment} from "hardhat/types"

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments, getNamedAccounts, network} = hre
  const { deploy } = deployments
  const {deployer} = await getNamedAccounts()

  await deploy("MarginAccountManager", {
    from: deployer,
    log: true,
    args: [],
  })
}

deployment.tags = ["margin_account_manager"]
deployment.dependencies = ["preparation"]

export default deployment
