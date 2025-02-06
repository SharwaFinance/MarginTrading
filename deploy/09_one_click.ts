import {HardhatRuntimeEnvironment} from "hardhat/types"
import {keccak256, toUtf8Bytes, solidityPacked, MaxUint256} from "ethers"

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments, getNamedAccounts} = hre
  const { deploy, get, execute } = deployments
  const {deployer} = await getNamedAccounts()

  const MarginAccountManager = await get("MarginAccountManager")
  const MarginTrading = await get("MarginTrading")
  const HegicPositionsManager = await get("HegicPositionsManager")
  const IProxySeller = await get("IProxySeller")
  const MarginAccount = await get("MarginAccount")
  const WETH_LiquidityPool = await get("WETH_LiquidityPool")
  const SwapRouter = await get("SwapRouter")
  const Quoter = await get("Quoter")
  const USDCe = await get("USDCe")
  const WETH = await get("WETH")  
  const USDC = await get("USDC")  
  const WBTC = await get("WBTC")  
  const MODULAR_SWAP_ROUTER_ROLE = keccak256(toUtf8Bytes("MODULAR_SWAP_ROUTER_ROLE"));
  const MANAGER_ROLE = keccak256(toUtf8Bytes("MANAGER_ROLE"));

  const OneClickMarginTrading = await deploy("OneClickMarginTrading", {
    from: deployer,
    log: true,
    args: [
      MarginAccountManager.address,
      MarginTrading.address,
      HegicPositionsManager.address,
      IProxySeller.address,
      MarginAccount.address,
      WETH_LiquidityPool.address,
      USDCe.address,
      deployer,
      WETH.address
    ],
  })
  
  let contractsMap = new Map<string, string>([
    ["WETH", WETH.address],
    ["WBTC", WBTC.address],
    ["USDC", USDC.address],
    ["USDCe", USDCe.address]
  ]);

  const arrayParams = [
    {"tokenIn": "WETH", "tokenOut" : "USDCe", "path": solidityPacked(["address", "uint24", "address"], [USDCe.address, 500, WETH.address])},
    {"tokenIn": "WBTC", "tokenOut" : "USDCe", "path": solidityPacked(["address", "uint24", "address"], [USDCe.address, 500, WBTC.address])},
    {"tokenIn": "USDC", "tokenOut" : "USDCe", "path": solidityPacked(["address", "uint24", "address"], [USDCe.address, 500, USDC.address])},
  ]

  async function deployUniswapModule(tokenIn: string, tokenOut: string, path: string) {
    const contractName = `${tokenIn}_${tokenOut}_UniswapModuleWithOneClick`

    let args = [
      OneClickMarginTrading.address,
      contractsMap.get(tokenIn),
      contractsMap.get(tokenOut),
      SwapRouter.address,
      Quoter.address,
      path
    ]

    const module = await deploy(contractName, {
      contract: "UniswapModuleWithOneClick",
      from: deployer,
      log: true,
      args: args,
    })

    await execute(
      contractName,
      {log: true, from: deployer},
      "grantRole",
      MODULAR_SWAP_ROUTER_ROLE,
      OneClickMarginTrading.address
    )

    await execute(
      contractName,
      {log: true, from: deployer},
      "grantRole",
      MANAGER_ROLE,
      deployer
    )

    await execute(
      "OneClickMarginTrading",
      {log: true, from: deployer},
      "setUniswapExchangeModules",
      contractsMap.get(tokenIn),
      contractsMap.get(tokenOut),
      module.address
    )

    await execute(
      "OneClickMarginTrading",
      {log: true, from: deployer},
      "approveERC20",
      WETH.address,
      WETH_LiquidityPool.address,
      MaxUint256
    )

    await execute(
      "OneClickMarginTrading",
      {log: true, from: deployer},
      "approveERC20",
      contractsMap.get(tokenIn),
      MarginAccount.address,
      MaxUint256
    )

    await execute(
      "OneClickMarginTrading",
      {log: true, from: deployer},
      "approveERC20",
      contractsMap.get(tokenIn),
      module.address,
      MaxUint256
    )

    await execute(
      "OneClickMarginTrading",
      {log: true, from: deployer},
      "approveERC20",
      contractsMap.get(tokenOut),
      IProxySeller.address,
      MaxUint256
    )

    await execute(
      "OneClickMarginTrading",
      {log: true, from: deployer},
      "approveERC721ForAll",
      HegicPositionsManager.address,
      MarginAccount.address,
      true
    )

    await execute(
      contractName,
      {log: true, from: deployer},
      "allApprove"
    )

  }

  for (let item in arrayParams) { 
    await deployUniswapModule(arrayParams[item].tokenIn, arrayParams[item].tokenOut, arrayParams[item].path)
  }


}

deployment.tags = ["upkeep_liquidations"]
deployment.dependencies = ["margin_trading"]

export default deployment
