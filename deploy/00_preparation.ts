import {HardhatRuntimeEnvironment} from "hardhat/types"
import { parseUnits } from "ethers";

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments, getNamedAccounts, network} = hre
  const {deploy, save, getArtifact, execute} = deployments
  const {deployer} = await getNamedAccounts()

    if (network.name == "hardhat") {
        const USDC = await deploy("USDC", {
            contract: "MockERC20",
            from: deployer,
            log: true,
            args: ["USDC (Mock)", "USDC", 6],
        })
        const USDCe = await deploy("USDCe", {
            contract: "MockERC20",
            from: deployer,
            log: true,
            args: ["USDCe (Mock)", "USDCe", 6],
        })
        const WETH = await deploy("WETH", {
            contract: "MockERC20",
            from: deployer,
            log: true,
            args: ["WETH (Mock)", "WETH", 18],
        })
        const WBTC = await deploy("WBTC", {
            contract: "MockERC20",
            from: deployer,
            log: true,
            args: ["WBTC (Mock)", "WBTC", 8],
        })
        const Quoter = await deploy("Quoter", {
            contract: "QuoterMock",
            from: deployer,
            log: true,
            args: [],
        })
        await deploy("SwapRouter", {
            contract: "SwapRouterMock",
            from: deployer,
            log: true,
            args: [
                Quoter.address
            ],
        })

        await execute("USDC",{log: true, from: deployer}, "mint", parseUnits("10", 6))
        await execute("WETH",{log: true, from: deployer}, "mint", parseUnits("0.01", 18))
        await execute("WBTC",{log: true, from: deployer}, "mint", parseUnits("0.001", 8))


        await execute("Quoter",{log: true, from: deployer}, "setSwapPrice", WETH.address, USDC.address, parseUnits("4000", 6))
        await execute("Quoter",{log: true, from: deployer}, "setSwapPrice", WETH.address, WBTC.address, parseUnits("0.0666", 8))
        await execute("Quoter",{log: true, from: deployer}, "setSwapPrice", WBTC.address, USDC.address, parseUnits("60000", 6))
        await execute("Quoter",{log: true, from: deployer}, "setSwapPrice", WBTC.address, WETH.address, parseUnits("15", 18))
        await execute("Quoter",{log: true, from: deployer}, "setSwapPrice", USDC.address, WETH.address, parseUnits("0.00025", 18))
        await execute("Quoter",{log: true, from: deployer}, "setSwapPrice", USDC.address, WBTC.address, parseUnits("0.000016", 8))
        await execute("Quoter",{log: true, from: deployer}, "setSwapPrice", USDCe.address, USDC.address, parseUnits("1", 6))

        const MockHegicStrategy = await deploy("MockHegicStrategy", {
            contract: "MockHegicStrategy",
            from: deployer,
            log: true,
            args: [],
        })

        await deploy("OperationalTreasury", {
            contract: "MockOperationalTreasury",
            from: deployer,
            log: true,
            args: [
                MockHegicStrategy.address,
                USDCe.address
            ],
        })

        await deploy("HegicPositionsManager", {
            contract: "MockPositionsManager",
            from: deployer,
            log: true,
            args: [],
        })

        await deploy("MockAggregatorV3_WETH_USDC", {contract: "MockAggregatorV3", from: deployer, log: true, args: [8, parseUnits("4000", 8)]})
        await deploy("MockAggregatorV3_WBTC_USDC", {contract: "MockAggregatorV3", from: deployer, log: true, args: [8, parseUnits("60000", 8)]})

    } else {
        save("USDCe", {
            address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
            abi: await getArtifact("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20").then((x) => x.abi),
        })   
    }
}

deployment.tags = ["preparation"]
export default deployment
