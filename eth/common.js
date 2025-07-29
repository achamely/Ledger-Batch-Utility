'use strict'

const FeeMarketEIP1559Transaction = require('@ethereumjs/tx').FeeMarketEIP1559Transaction;
const bytesToHex = require('@ethereumjs/util').bytesToHex;
const AppEth = require('@ledgerhq/hw-app-eth').default;
const Chain = require('@ethereumjs/common').Chain;
const Hardfork = require('@ethereumjs/common').Hardfork;
const Common = require('@ethereumjs/common').Common;
const Web3 = require('web3').Web3;
const Transport = require('@ledgerhq/hw-transport-node-hid').default;
const request = require('request-promise');
const ledgerService = require('@ledgerhq/hw-app-eth').ledgerService;
const { createInterface } = require('readline');
const fs = require('fs');

const config = require('./ethConfig.json');
const web3 = new Web3(new Web3.providers.HttpProvider(config.web3url));
const chainId = Chain.Mainnet;
const common = new Common({ chain: chainId, hardfork: Hardfork.London, eips: [1559] });
const rl = createInterface(process.stdin, process.stdout);

const adminABI = [{"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"owners","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"owner","type":"address"}],"name":"removeOwner","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"transactionId","type":"uint256"}],"name":"revokeConfirmation","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"isOwner","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"uint256"},{"name":"","type":"address"}],"name":"confirmations","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"pending","type":"bool"},{"name":"executed","type":"bool"}],"name":"getTransactionCount","outputs":[{"name":"count","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"owner","type":"address"}],"name":"addOwner","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"transactionId","type":"uint256"}],"name":"isConfirmed","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"transactionId","type":"uint256"}],"name":"getConfirmationCount","outputs":[{"name":"count","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"transactions","outputs":[{"name":"destination","type":"address"},{"name":"value","type":"uint256"},{"name":"data","type":"bytes"},{"name":"executed","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getOwners","outputs":[{"name":"","type":"address[]"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"from","type":"uint256"},{"name":"to","type":"uint256"},{"name":"pending","type":"bool"},{"name":"executed","type":"bool"}],"name":"getTransactionIds","outputs":[{"name":"_transactionIds","type":"uint256[]"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"transactionId","type":"uint256"}],"name":"getConfirmations","outputs":[{"name":"_confirmations","type":"address[]"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"transactionCount","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_required","type":"uint256"}],"name":"changeRequirement","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"transactionId","type":"uint256"}],"name":"confirmTransaction","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"destination","type":"address"},{"name":"value","type":"uint256"},{"name":"data","type":"bytes"}],"name":"submitTransaction","outputs":[{"name":"transactionId","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"MAX_OWNER_COUNT","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"required","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"owner","type":"address"},{"name":"newOwner","type":"address"}],"name":"replaceOwner","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"transactionId","type":"uint256"}],"name":"executeTransaction","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[{"name":"_owners","type":"address[]"},{"name":"_required","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"sender","type":"address"},{"indexed":true,"name":"transactionId","type":"uint256"}],"name":"Confirmation","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"sender","type":"address"},{"indexed":true,"name":"transactionId","type":"uint256"}],"name":"Revocation","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"transactionId","type":"uint256"}],"name":"Submission","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"transactionId","type":"uint256"}],"name":"Execution","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"transactionId","type":"uint256"}],"name":"ExecutionFailure","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"sender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Deposit","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"}],"name":"OwnerAddition","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"}],"name":"OwnerRemoval","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"required","type":"uint256"}],"name":"RequirementChange","type":"event"}]
const adminMSIG = new web3.eth.Contract(adminABI, config.contract_address)

let txHashes = []

async function createLedger() {
  console.log('Ledger initialized');
  const transport = await Transport.create();
  return new AppEth(transport);
}

function padLeftZeros(stringItem) {
  return stringItem.padStart(64, '0');
}

function getTxData(nonce, data, gasLimit, gasPrice, maxFeePerGas, contractAddress) {
  return {
    data,
    nonce: web3.utils.toHex(nonce),
    gasLimit: web3.utils.toHex(gasLimit),
    maxPriorityFeePerGas: web3.utils.toHex(gasPrice),
    maxFeePerGas: web3.utils.toHex(maxFeePerGas),
    to: contractAddress,
    value: '0x00',
    r: web3.utils.toHex(chainId),
    v: '0x',
    s: '0x',
  };
}

function decodeData(hex) {

  let method,addr,value;

  switch (hex.slice(0,10)) {
    case '0x0ecb93c0':
      method = 'addBlackList';
      addr = '0x'+hex.slice(34,74);
      value = 0;
      break;
    case '0x3c7c9b90':
      method = 'addToBlockedList';
      addr = '0x'+hex.slice(34,74);
      value = 0;
      break;
    case '0xf3bdc228':
      method = 'destroyBlackFunds';
      addr = '0x'+hex.slice(34,74);
      value = 0;
      break;
    case '0x0e27a385':
      method = 'destroyBlockedFunds';
      addr = '0x'+hex.slice(34,74);
      value = 0;
      break;
    case '0xe4997dc5':
      method = 'removeBlackList';
      addr = '0x'+hex.slice(34,74);
      value = 0;
      break;
    case '0x1a14f449':
      method = 'removeFromBlockedList';
      addr = '0x'+hex.slice(34,74);
      value = 0;
      break;
    case '0x7065cb48':
      method = 'addOwner';
      addr = '0x'+hex.slice(34,74);
      value = 0;
      break;
    case '0x173825d9':
      method = 'removeOwner';
      addr = '0x'+hex.slice(34,74);
      value = 0;
      break;
    case '0xe20056e6':
      method = 'replaceOwner';
      addrA = '0x'+hex.slice(34,74);
      addrB = '0x'+hex.slice(98,138);
      addr = addrA+'->'+addrB
      value = 0;
      break;
    case '0xcc872b66':
      method = 'issue';
      addr = '';
      value = parseInt(hex.slice(10,74).replace(/\b0+/g, ''),16)/1e6;
      break;
    case '0x40c10f19':
      method = 'mint';
      addr = '0x'+hex.slice(34,74);
      value = parseInt(hex.slice(74,138).replace(/\b0+/g, ''),16)/1e6;
      break;
    case '0xdb006a75':
      method = 'redeem';
      addr = '';
      value = parseInt(hex.slice(10,74).replace(/\b0+/g, ''),16)/1e6;
      break;
    case '0xa9059cbb':
      method = 'transfer';
      addr = '0x'+hex.slice(34,74);
      value = parseInt(hex.slice(74,138).replace(/\b0+/g, ''),16)/1e6;
      break;
    case '0x8456cb59':
      method = 'pause';
      addr = '';
      value = 0;
      break;
    case '0x99a88ec4':
      method = 'proxy-upgrade';
      addr = '0x'+hex.slice(34,74);
      value = '0x'+hex.slice(98,138);
      break;
    case '0x0753c30c':
      method = 'deprecate';
      addr = '0x'+hex.slice(34,74);
      value = 0;
      break;
    case '0x4e71e0c8':
      method = 'claimOwnership';
      value = 0;
      addr = '';
      break
    case '0x078dfbe7':
      method = 'transferOwnership';
      addr = '0x'+hex.slice(34,74);
      direct = parseInt(hex.slice(74,138));
      renounce = parseInt(hex.slice(138,276));
      value = `Direct:${direct},Renounce:${renounce}`;
      break
    case '0x62a5af3b':
      method = 'freezeOracle';
      value = 0;
      addr = '';
      break
    case '0x6a28f000':
      method = 'unfreezeOracle';
      value = 0;
      addr = '';
      break
    case '0xabee062b':
      method = 'setMaximumDeltaPercentage';
      value = parseInt(hex.slice(10,74).replace(/\b0+/g, ''),16)/1e6;
      addr = '';
      break
    case '0x558a7297':
      method = 'setOperator';
      addr = '0x'+hex.slice(34,74);
      value = parseInt(hex.slice(74,138));
      break;
    case '0xe5a98603':
      method = 'setThreshold'
      value = parseInt(hex.slice(10,74).replace(/\b0+/g, ''),16);
      addr = '';
      break;
    default:
      method = 'unknown';
      value = 0;
      addr = '';
  }
  return {'method':method,'value':value,'addr':addr}
}


async function updateGas(baseGas = 2) {
  let ethGasStationData = await request.get({
    url: `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${config.etherscanApiKey}`,
    json: true,
  });
  if (ethGasStationData.status === '1') {
    let gasPrice = parseInt(ethGasStationData.result.FastGasPrice) - parseInt(ethGasStationData.result.ProposeGasPrice);
    if (gasPrice < baseGas) {
      gasPrice = baseGas
    }
    let maxFeePerGas = ((parseInt(ethGasStationData.result.suggestBaseFee) * 2) + gasPrice) * 10e8;
    return { gasPrice, maxFeePerGas };
  } else {
    console.log('Error fetching gas data');
    process.exit(1);
  }
}

async function broadcast(signedtx) {
  console.log('Broadcasting...');
  try {
    await web3.eth.sendSignedTransaction(signedtx, (err, hash) => {
      if (err) console.log('Broadcast Failed:', err.message);
      else console.log(hash);
    });
  } catch (err) {
    console.log('Broadcast Failed:', err.message);
  }
}

async function broadcastEtherscan(signedtx) {
  console.log('Broadcasting to Etherscan...');
  try {
    let response = await request({
      url: `https://api.etherscan.io/api?module=proxy&action=eth_sendRawTransaction&hex=${signedtx}&apikey=${config.etherscanApiKey}`,
      json: true,
    });
    console.log(response.result);
  } catch (err) {
    console.log('Etherscan Broadcast Failed:', err.message);
  }
}


async function broadcastFlashbot(signedtx) {
  console.log('Broadcasting to Flashbot...');
  try {
    let response = await request.post({
      headers: { 'content-type': 'application/json' },
      url: 'https://rpc.flashbots.net/fast',
      body: {
        jsonrpc: '2.0',
        method: 'eth_sendRawTransaction',
        params: [signedtx],
        id: 1,
      },
      json: true,
    });
    if (response.error) {
      console.log('Flashbot Broadcast Error:', response.error.message);
    } else {
      console.log(response.result);
      txHashes.push(response.result);
    }
  } catch (err) {
    console.log("Flashbot Broadcast Failed: \x1b[32m%s\x1b[0m",err)
  }
}

async function broadcastFlashbotBundle(signedtxarray) {
  console.log('Broadcasting to Flashbot...');
  try {
    let response = await request.post({
      headers: { 'content-type': 'application/json' },
      url: 'https://rpc.flashbots.net/fast',
      body: {
        jsonrpc: '2.0',
        method: 'eth_sendBundle',
        params: [{
          txs: signedtxarray,
        }],
        id: 1,
      },
      json: true,
    });
    if (response.error) {
      console.log('Flashbot Broadcast Error:', response.error.message);
    } else {
      console.log(response.result.bundleHash);
      txHashes.push(response.result.bundleHash);
    }
  } catch (err) {
    console.log("Flashbot Broadcast Failed: \x1b[32m%s\x1b[0m",err)
  }
}

async function confirmBroadcast(signedtx) {
  return new Promise((resolve) => {
    rl.question('\nConfirm TX information and Broadcast? [y/n]: ', async (answer) => {
      if (answer === 'y') {
        await broadcast(signedtx);
      } else {
        console.log('Aborting');
      }
      resolve(answer);
    });
  });
}

module.exports = {
  createLedger,
  padLeftZeros,
  getTxData,
  decodeData,
  updateGas,
  broadcast,
  broadcastEtherscan,
  broadcastFlashbot,
  broadcastFlashbotBundle,
  confirmBroadcast,
  web3,
  common,
  FeeMarketEIP1559Transaction,
  bytesToHex,
  ledgerService,
  rl,
  adminMSIG,
  txHashes,
  fs,
};
