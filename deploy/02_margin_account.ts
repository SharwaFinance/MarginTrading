import {HardhatRuntimeEnvironment} from "hardhat/types"
import { ethers } from "hardhat";
import {keccak256, toUtf8Bytes} from "ethers"

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments, getNamedAccounts, network} = hre
  const { deploy, get, execute } = deployments
  const {deployer} = await getNamedAccounts()
  const signers = await ethers.getSigners()

  const USDC = await get("USDC")
  const WETH = await get("WETH")
  const WBTC = await get("WBTC")
  const HegicPositionsManager = await get("HegicPositionsManager")
  const MANAGER_ROLE = keccak256(toUtf8Bytes("MANAGER_ROLE"));

  let insurancePool: string
  if (network.name == "hardhat") {
    insurancePool = await signers[5].getAddress()
  } else {
    insurancePool = "0xEE1c5a8c397F4D6BBC33BAd080e77D531C6d8Ce5"
  }

  await deploy("MarginAccount", {
    from: deployer,
    log: true,
    args: [
      insurancePool         //_insurancePool
    ],
  })

  await execute(
    "MarginAccount",
    {log: true, from: deployer},
    "grantRole",
    MANAGER_ROLE,
    deployer
  )

  await execute(
    "MarginAccount",
    {log: true, from: deployer},
    "grantRole",
    MANAGER_ROLE,
    deployer
  )

  await execute(
    "MarginAccount",
    {log: true, from: deployer},
    "setAvailableErc20",
    [USDC.address, WETH.address, WBTC.address], //_availableErc20
  )

  await execute(
    "MarginAccount",
    {log: true, from: deployer},
    "setIsAvailableErc20",
    USDC.address,   //token
    true            //value
  )

  await execute(
    "MarginAccount",
    {log: true, from: deployer},
    "setIsAvailableErc20",
    WETH.address,   //token
    true            //value
  )

  await execute(
    "MarginAccount",
    {log: true, from: deployer},
    "setIsAvailableErc20",
    WBTC.address,   //token
    true            //value
  )

  await execute(
    "MarginAccount",
    {log: true, from: deployer},
    "setAvailableErc721",
    [HegicPositionsManager.address]             //_availableErc721
  )

  await execute(
    "MarginAccount",
    {log: true, from: deployer},
    "setIsAvailableErc721",
    HegicPositionsManager.address,   //token
    true                              //value
  )

}

deployment.tags = ["margin_account"]
deployment.dependencies = ["preparation", "margin_account_manager"]

export default deployment
