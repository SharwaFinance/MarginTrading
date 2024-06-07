import {HardhatRuntimeEnvironment} from "hardhat/types"
import {keccak256, toUtf8Bytes} from "ethers"

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments, getNamedAccounts} = hre
  const { deploy, get, execute } = deployments
  const {deployer} = await getNamedAccounts()

  const USDC = await get("USDC")
  const MarginAccountManager = await get("MarginAccountManager")
  const MarginAccount = await get("MarginAccount")

  const MANAGER_ROLE = keccak256(toUtf8Bytes("MANAGER_ROLE"));
  const MARGIN_TRADING_ROLE = keccak256(toUtf8Bytes("MARGIN_TRADING_ROLE")); 

  const MarginTrading = await deploy("MarginTrading", {
    from: deployer,
    log: true,
    args: [
      MarginAccountManager.address,            //_positionsManager
      USDC.address,                            //_baseToken
      MarginAccount.address             //_portfolioLendingStorage
    ],
  })

  await execute(
    "MarginTrading",
    {log: true, from: deployer},
    "grantRole",
    MANAGER_ROLE,
    deployer
  )

  await execute(
    "MarginAccount",
    {log: true, from: deployer},
    "grantRole",
    MARGIN_TRADING_ROLE,
    MarginTrading.address
  )
}

deployment.tags = ["margin_trading"]
deployment.dependencies = ["preparation", "margin_account_manager", "margin_account"]

export default deployment
