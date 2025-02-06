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

        await deploy("AggregatorV3_WETH_USDC", {contract: "MockAggregatorV3", from: deployer, log: true, args: [8, parseUnits("4000", 8)]})
        await deploy("AggregatorV3_WBTC_USDC", {contract: "MockAggregatorV3", from: deployer, log: true, args: [8, parseUnits("60000", 8)]})

        await deploy("SequencerUptimeFeed", {contract: "MockAggregatorV3", from: deployer, log: true, args: [0, 0]})

    } else {
        save("USDCe", {
            address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
            abi: await getArtifact("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20").then((x) => x.abi),
        })

        save("USDC", {
            address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            abi: await getArtifact("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20").then((x) => x.abi),
        })

        save("WETH", {
            address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
            abi: await getArtifact("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20").then((x) => x.abi),
        })

        save("WBTC", {
            address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
            abi: await getArtifact("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20").then((x) => x.abi),
        })

        save("Quoter", {
            address: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
            abi: await getArtifact("contracts/interfaces/modularSwapRouter/uniswap/IQuoter.sol:IQuoter").then((x) => x.abi),
        }) 

        save("SwapRouter", {
            address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            abi: await getArtifact("@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol:ISwapRouter").then((x) => x.abi),
        })

        save("OperationalTreasury", {
            address: "0xec096ea6eB9aa5ea689b0CF00882366E92377371",
            abi: await getArtifact("contracts/interfaces/modularSwapRouter/hegic/IOperationalTreasury.sol:IOperationalTreasury").then((x) => x.abi),
          })
      
        save("HegicPositionsManager", {
            address: "0x5Fe380D68fEe022d8acd42dc4D36FbfB249a76d5",
            abi: await getArtifact("contracts/interfaces/modularSwapRouter/hegic/IPositionsManager.sol:IPositionsManager").then((x) => x.abi),
        })

        save("AggregatorV3_WETH_USDC", {
            address: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
            abi: await getArtifact("@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol:AggregatorV3Interface").then((x) => x.abi),
        })

        save("AggregatorV3_WBTC_USDC", {
            address: "0x6ce185860a4963106506C203335A2910413708e9",
            abi: await getArtifact("@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol:AggregatorV3Interface").then((x) => x.abi),
        })

        save("SequencerUptimeFeed", {
            address: "0xFdB631F5EE196F0ed6FAa767959853A9F217697D",
            abi: await getArtifact("@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV2V3Interface.sol:AggregatorV2V3Interface").then((x) => x.abi),
        })

        save("IProxySeller", {
            address: "0x7740FC99bcaE3763a5641e450357a94936eaF380",
            abi: await getArtifact("contracts/interfaces/oneClick/IProxySeller.sol:IProxySeller").then((x) => x.abi),
          })
    }
}

deployment.tags = ["preparation"]
export default deployment
