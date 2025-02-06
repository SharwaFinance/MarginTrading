import {HardhatRuntimeEnvironment} from "hardhat/types"
import { MaxUint256, parseUnits, keccak256, toUtf8Bytes } from "ethers"
import { ethers } from "hardhat";

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments, getNamedAccounts, network} = hre
  const { deploy, get, execute } = deployments
  const {deployer} = await getNamedAccounts()
  const signers = await ethers.getSigners()

  let insurancePool: string
  if (network.name == "hardhat") {
    insurancePool = await signers[5].getAddress()
  } else {
    insurancePool = "0xEE1c5a8c397F4D6BBC33BAd080e77D531C6d8Ce5"
  }

  const WETH = await get("WETH")
  const WBTC = await get("WBTC")
  const USDC = await get("USDC")
  const MarginAccount = await get("MarginAccount")
  const MANAGER_ROLE = keccak256(toUtf8Bytes("MANAGER_ROLE"));

  const WETH_LiquidityPool = await deploy("WETH_LiquidityPool", {
    contract: "LiquidityPool",
    from: deployer,
    log: true,
    args: [
      insurancePool,
      MarginAccount.address,
      USDC.address,
      WETH.address,
      'SF-LP-WETH',
      'SF-LP-WETH',
      parseUnits("37", 18)
    ],
  })

  await execute(
    "WETH_LiquidityPool",
    {log: true, from: deployer},
    "grantRole",
    MANAGER_ROLE,
    deployer
  )

  await execute(
    "WETH_LiquidityPool",
    {log: true, from: deployer},
    "setInterestRate",
    0.047*1e4
  )

  const WBTC_LiquidityPool = await deploy("WBTC_LiquidityPool", {
    contract: "LiquidityPool",
    from: deployer,
    log: true,
    args: [
      insurancePool,
      MarginAccount.address,
      USDC.address,
      WBTC.address,
      'SF-LP-WBTC',
      'SF-LP-WBTC',
      parseUnits("1", 8)
    ],
  })

  await execute(
    "WBTC_LiquidityPool",
    {log: true, from: deployer},
    "grantRole",
    MANAGER_ROLE,
    deployer
  )

  await execute(
    "WBTC_LiquidityPool",
    {log: true, from: deployer},
    "setInterestRate",
    0.005*1e4
  )

  const USDC_LiquidityPool = await deploy("USDC_LiquidityPool", {
    contract: "LiquidityPool",
    from: deployer,
    log: true,
    args: [
      insurancePool,
      MarginAccount.address,
      USDC.address,
      USDC.address,
      'SF-LP-USDC',
      'SF-LP-USDC',
      parseUnits("100000", 6)
    ],
  })

  await execute(
    "USDC_LiquidityPool",
    {log: true, from: deployer},
    "grantRole",
    MANAGER_ROLE,
    deployer
  )

  await execute(
    "USDC_LiquidityPool",
    {log: true, from: deployer},
    "setInterestRate",
    0.11*1e4
  )

  await execute(
    "MarginAccount",
    {log: true, from: deployer},
    "setAvailableTokenToLiquidityPool",
    [WETH.address, WBTC.address, USDC.address]
  )

  await execute(
    "MarginAccount",
    {log: true, from: deployer},
    "setTokenToLiquidityPool",
    WETH.address, 
    WETH_LiquidityPool.address
  )

  await execute(
    "MarginAccount",
    {log: true, from: deployer},
    "approveERC20",
    WETH.address,
    WETH_LiquidityPool.address,
    MaxUint256
  )

  await execute(
    "MarginAccount",
    {log: true, from: deployer},
    "setTokenToLiquidityPool",
    WBTC.address, 
    WBTC_LiquidityPool.address
  )

  await execute(
    "MarginAccount",
    {log: true, from: deployer},
    "approveERC20",
    WBTC.address, 
    WBTC_LiquidityPool.address,
    MaxUint256
  )

  await execute(
    "MarginAccount",
    {log: true, from: deployer},
    "setTokenToLiquidityPool",
    USDC.address, 
    USDC_LiquidityPool.address
  )

  await execute(
    "MarginAccount",
    {log: true, from: deployer},
    "approveERC20",
    USDC.address, 
    USDC_LiquidityPool.address,
    MaxUint256
  )

  await execute(
    "USDC",
    {log: true, from: deployer},
    "approve",
    USDC_LiquidityPool.address,
    parseUnits("10", 6)
  )

  await execute(
    "USDC_LiquidityPool",
    {log: true, from: deployer},
    "provide",
    parseUnits("10", 6)
  )

  await execute(
    "WETH",
    {log: true, from: deployer},
    "approve",
    WETH_LiquidityPool.address,
    parseUnits("0.01", 18)
  )

  await execute(
    "WETH_LiquidityPool",
    {log: true, from: deployer},
    "provide",
    parseUnits("0.01", 18)
  )

  await execute(
    "WBTC",
    {log: true, from: deployer},
    "approve",
    WBTC_LiquidityPool.address,
    parseUnits("0.001", 8)
  )

  await execute(
    "WBTC_LiquidityPool",
    {log: true, from: deployer},
    "provide",
    parseUnits("0.001", 8)
  )

}

deployment.tags = ["liquidity_pool"]
deployment.dependencies = ["preparation", "margin_account"]

export default deployment
