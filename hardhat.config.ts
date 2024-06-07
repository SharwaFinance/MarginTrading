import { HardhatUserConfig } from "hardhat/config";
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import "@keep-network/hardhat-local-networks-config";
import 'hardhat-contract-sizer';

const config: HardhatUserConfig = {
  localNetworksConfig: "~/.hardhat/networks.json",
  solidity: "0.8.20",
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
};

export default config;
