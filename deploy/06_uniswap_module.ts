import {HardhatRuntimeEnvironment} from "hardhat/types"
import {solidityPacked, MaxUint256, keccak256, toUtf8Bytes} from "ethers"

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments, getNamedAccounts} = hre
  const { deploy, get, execute } = deployments
  const {deployer} = await getNamedAccounts()

  const MarginAccount = await get("MarginAccount")
  const ModularSwapRouter = await get("ModularSwapRouter")
  const SwapRouter = await get("SwapRouter")
  const Quoter = await get("Quoter")
  const WETH = await get("WETH")
  const WBTC = await get("WBTC")
  const USDC = await get("USDC")

  const MODULAR_SWAP_ROUTER_ROLE = keccak256(toUtf8Bytes("MODULAR_SWAP_ROUTER_ROLE"));
  const MANAGER_ROLE = keccak256(toUtf8Bytes("MANAGER_ROLE"));

  let contractsMap = new Map<string, string>([
    ["WETH", WETH.address],
    ["WBTC", WBTC.address],
    ["USDC", USDC.address]
  ]);

  const arrayParams = [
    {"tokenIn": "WETH", "tokenOut" : "USDC", "path": solidityPacked(["address", "uint24", "address"], [WETH.address, 3000, USDC.address])},
    {"tokenIn": "WETH", "tokenOut" : "WBTC", "path": solidityPacked(["address", "uint24", "address"], [WETH.address, 3000, WBTC.address])},
    {"tokenIn": "WBTC", "tokenOut" : "USDC", "path": solidityPacked(["address", "uint24", "address"], [WBTC.address, 3000, USDC.address])},
    {"tokenIn": "WBTC", "tokenOut" : "WETH", "path": solidityPacked(["address", "uint24", "address"], [WBTC.address, 3000, WETH.address])},
    {"tokenIn": "USDC", "tokenOut" : "WETH", "path": solidityPacked(["address", "uint24", "address"], [USDC.address, 3000, WETH.address])},
    {"tokenIn": "USDC", "tokenOut" : "WBTC", "path": solidityPacked(["address", "uint24", "address"], [USDC.address, 3000, WBTC.address])},
  ]

  async function deployUniswapModule(tokenIn: string, tokenOut: string, path: string) {
    // console.log(`path ${tokenIn}_${tokenOut}`, path)
    const contractName = `${tokenIn}_${tokenOut}_UniswapModule`
    const module = await deploy(contractName, {
      contract: "UniswapModule",
      from: deployer,
      log: true,
      args: [
        MarginAccount.address,
        contractsMap.get(tokenIn),
        contractsMap.get(tokenOut),
        SwapRouter.address,
        Quoter.address,
        path
      ],
    })

    await execute(
      contractName,
      {log: true, from: deployer},
      "grantRole",
      MODULAR_SWAP_ROUTER_ROLE,
      ModularSwapRouter.address
    )

    await execute(
      contractName,
      {log: true, from: deployer},
      "grantRole",
      MANAGER_ROLE,
      deployer
    )

    await execute(
      contractName,
      {log: true, from: deployer},
      "allApprove"
    )

    await execute(
      "ModularSwapRouter",
      {log: true, from: deployer},
      "setTokenInToTokenOutToExchange",
      contractsMap.get(tokenIn),
      contractsMap.get(tokenOut),
      module.address
    )

    await execute(
      "MarginAccount",
      {log: true, from: deployer},
      "approveERC20",
      contractsMap.get(tokenIn), 
      module.address,
      MaxUint256
    )

  }

  for (let item in arrayParams) { 
    await deployUniswapModule(arrayParams[item].tokenIn, arrayParams[item].tokenOut, arrayParams[item].path)
  }

}

deployment.tags = ["uniswap_module"]
deployment.dependencies = ["margin_account", "modular_swap_router"]

export default deployment
