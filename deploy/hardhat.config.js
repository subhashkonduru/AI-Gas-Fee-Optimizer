require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');

const RPC_URL = process.env.RPC_URL || '';
const PRIVATE_KEY = process.env.DEPLOYER_KEY || '';

module.exports = {
  solidity: '0.8.18',
  networks: {
    arbitrum: {
      url: RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    arbitrumGoerli: {
      url: process.env.GOERLI_RPC_URL || RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    }
  }
};
