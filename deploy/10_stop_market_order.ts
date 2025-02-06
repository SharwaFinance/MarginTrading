import {HardhatRuntimeEnvironment} from "hardhat/types"
import { keccak256, toUtf8Bytes } from "ethers"

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments, getNamedAccounts, network} = hre
  const { deploy, get, execute } = deployments
  const {deployer} = await getNamedAccounts()

  const WBTC = await get("WBTC");
  const WETH = await get("WETH");
  const MarginAccount = await get("MarginAccount");
  const MarginTrading = await get("MarginTrading");
  const MarginAccountManager = await get("MarginAccountManager");
  const AggregatorV3_WBTC_USDC = await get("AggregatorV3_WBTC_USDC");
  const AggregatorV3_WETH_USDC = await get("AggregatorV3_WETH_USDC");
  const MANAGER_ROLE = keccak256(toUtf8Bytes("MANAGER_ROLE"));

  await deploy("StopMarketOrder", {
    from: deployer,
    log: true,
    args: [
      MarginAccount.address,
      MarginTrading.address,
      MarginAccountManager.address
    ],
  });

  await execute(
    "StopMarketOrder",
    {log: true, from: deployer},
    "grantRole",
    MANAGER_ROLE,
    deployer
  );

  await execute(
    "StopMarketOrder",
    {log: true, from: deployer},
    "setAvailableTokenToChainLinkData",
    WBTC.address, 
    AggregatorV3_WBTC_USDC.address
  );

  await execute(
    "StopMarketOrder",
    {log: true, from: deployer},
    "setAvailableTokenToChainLinkData",
    WETH.address, 
    AggregatorV3_WETH_USDC.address
  );
}

deployment.tags = ["stop_market_order"]
deployment.dependencies = ["preparation", "margin_account", "liquidity_pool", "modular_swap_router", "uniswap_module", "hegic_module", "margin_trading", "margin_account_manager"]

export default deployment
