Gas Whisperer — deploy folder

This folder contains a minimal Hardhat project to deploy a placeholder contract (Greeter) to Arbitrum networks.

Setup (one-time)
1. Install Node.js (>=16) and npm.
2. From this folder install dev deps:

   # PowerShell
   cd deploy
   npm install

3. Create a `.env` file in `deploy/` based on `.env.example` and set `RPC_URL` and `DEPLOYER_KEY`.

Deploy to Arbitrum mainnet

  # PowerShell
  cd deploy
  $env:RPC_URL = 'https://arb1.arbitrum.io/rpc'    # or set in deploy/.env
  $env:DEPLOYER_KEY = '0xYOUR_PRIVATE_KEY'
  npm run deploy:arbitrum

Deploy to Arbitrum Goerli (testnet)

  # PowerShell
  cd deploy
  $env:GOERLI_RPC_URL = 'https://goerli-rollup.arbitrum.io/rpc'
  $env:DEPLOYER_KEY = '0xYOUR_PRIVATE_KEY'
  npm run deploy:goerli

The deploy script prints the deployed contract address. For production use, replace `Greeter.sol` with your actual contract and update the deploy script accordingly.

Security note: do not commit private keys. Use environment variables or a secure secret manager.
