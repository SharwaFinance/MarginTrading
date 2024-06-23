# MarginTrading

The project realizes margin account abstraction built on Arbitrum. Users can trade on Uniswap v3 with up to 10x leverage, as well as use American-style options from Hegic as part of the collateral.

```shell
    "build": "npx hardhat clean && npx hardhat compile",
    "clean": "npx hardhat clean",
    "test": "npx hardhat test"
```


## Foundry usage

### Setup

Install dependencies.

```shell
yarn
```

Install Foundry, if you haven't already. 

```shell
curl -L https://foundry.paradigm.xyz | bash
```

Visit Foundry [documentation](https://book.getfoundry.sh/getting-started/installation) for more information.

### Build

```shell
forge build
```

### Run the tests

```shell
forge test
```

To run a specific test with logs use the following command:

```shell
forge test --mt test_name -vv
```