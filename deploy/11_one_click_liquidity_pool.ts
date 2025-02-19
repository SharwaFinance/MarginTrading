import {HardhatRuntimeEnvironment} from "hardhat/types"
import {MaxUint256} from "ethers"

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments, getNamedAccounts} = hre
  const { deploy, get, execute } = deployments
  const {deployer} = await getNamedAccounts()

  const WETH_LiquidityPool = await get("WETH_LiquidityPool")
  const WETH = await get("WETH")  

await deploy("OneClickLiquidityPool", {
    from: deployer,
    log: true,
    args: [
      WETH_LiquidityPool.address,
      WETH.address
    ],
  })

    await execute(
      "OneClickLiquidityPool",
      {log: true, from: deployer},
      "approveERC20",
      WETH.address,
      WETH_LiquidityPool.address,
      MaxUint256
    )
}

deployment.tags = ["one_click_liquidity_pool"]
deployment.dependencies = ["margin_trading"]

export default deployment
