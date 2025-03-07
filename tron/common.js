'use strict'

const Transport = require('@ledgerhq/hw-transport-node-hid').default;
const AppTrx = require('@ledgerhq/hw-app-trx').default;
const request = require('request-promise');
const TronWeb = require('tronweb');

const { createInterface } = require('readline');
const rl = createInterface(process.stdin, process.stdout);
const fs = require('fs');

const config = require('./tronConfig.json');
const tronWebOptions = {
  fullHost: config.fullHostURL
};

if (!(config.trongridApiKey === null || config.trongridApiKey.trim() === '')) {
  tronWebOptions.headers = { "TRON-PRO-API-KEY": config.trongridApiKey }
};

const tronWeb = new TronWeb(tronWebOptions);
tronWeb.setAddress(config.contract_address);

const msigContractAddress = config.contract_address;
let msigContract = null;

async function initContracts() {
  try {
    msigContract = await tronWeb.contract().at(msigContractAddress);
  } catch (err) {
    console.error("Failed to initialize contract:", err);
  }
}

function getMsigContract() {
  if (!msigContract) {
    throw new Error("msigContract is not initialized. Did you call initContracts()?");
  }
  return msigContract;
}

async function createLedger() {
  console.log('Ledger initialized');
  const transport = await Transport.create();
  return new AppTrx(transport);
}

function padLeftZeros(stringItem) {
  return stringItem.padStart(64, '0');
}

async function getTxData (type,data,dest) {
 let parameter,action;

  switch (type) {
    case 'submit':
      parameter = [{type:'address',value:dest},{type:'uint256',value:0},{type:'bytes',value:data}];
      action = "submitTransaction(address,uint256,bytes)";
      break;
    case 'confirm':
      parameter = [{type:'uint256',value:data}];
      action = "confirmTransaction(uint256)";
      break;
    case 'revoke':
      parameter = [{type:'uint256',value:data}];
      action = "revokeConfirmation(uint256)";
      break;
    default:
      console.log("Invalid TxData type",type);
      return
  }
  var options = {
        feeLimit:config.feeLimit,
        callValue:0
    };
  let sc,signer
  sc = tronWeb.address.toHex(msigContractAddress).toLowerCase();
  signer = tronWeb.address.toHex(config.signerAddress).toLowerCase();
  const txo = await tronWeb.transactionBuilder.triggerSmartContract(sc, action, options,  parameter, signer);
  return txo
}

function decodeData(hex) {
  let method,addr,value;

  switch (hex.slice(0,10)) {
    case '0x0ecb93c0':
      method = 'addBlackList';
      addr = hex.slice(32,74);
      value = 0;
      break;
    case '0x3c7c9b90':
      method = 'addToBlockedList';
      addr = hex.slice(32,74);
      value = 0;
      break;
    case '0xf3bdc228':
      method = 'destroyBlackFunds';
      addr = hex.slice(32,74);
      value = 0;
      break;
    case '0x0e27a385':
      method = 'destroyBlockedFunds';
      addr = hex.slice(32,74);
      value = 0;
      break;
    case '0xe4997dc5':
      method = 'removeBlackList';
      addr = hex.slice(32,74);
      value = 0;
      break;
    case '0x1a14f449':
      method = 'removeFromBlockedList';
      addr = hex.slice(32,74);
      value = 0;
      break;
    case '0x7065cb48':
      method = 'addOwner';
      addr = hex.slice(32,74);
      value = 0;
      break;
    case '0xcc872b66':
      method = 'issue';
      addr = '';
      value = parseInt(hex.slice(10,74).replace(/\b0+/g, ''),16)/1e6;
      break;
    case '0x40c10f19':
      method = 'mint';
      addr = hex.slice(32,74);
      value = parseInt(hex.slice(74,138).replace(/\b0+/g, ''),16)/1e6;
      break;
    case '0xdb006a75':
      method = 'redeem';
      addr = '';
      value = parseInt(hex.slice(10,74).replace(/\b0+/g, ''),16)/1e6;
      break;
    case '0xa9059cbb':
      method = 'transfer';
      addr = hex.slice(32,74);
      value = parseInt(hex.slice(74,138).replace(/\b0+/g, ''),16)/1e6;
      break;
    case '0x8456cb59':
      method = 'pause';
      addr = '';
      value = 0;
      break;
    case '0x99a88ec4':
      method = 'proxy-upgrade';
      addr = hex.slice(32,74);
      value = tronWeb.address.fromHex(hex.slice(96,138));
      break;
    case '0x0753c30c':
      method = 'deprecate';
      addr = hex.slice(32,74);
      value = 0;
      break;
    default:
      method = 'unknown';
      value = 0;
      addr = '';
  }
  return {'method':method,'value':value,'addr':addr}
}

async function broadcast (signedtx) {
    //broadcast final tx
    console.log("Broadcasting...")
    try {
      await tronWeb.trx.sendRawTransaction(signedtx, async function(err, result) {
        if (!err) {
          console.log(result.transaction.txID);
        } else {
          console.log(err);
        }
      });
    } catch (err) {
      console.log("Broadcast Failed: \x1b[32m%s\x1b[0m",err)
    }
}

module.exports = {
  createLedger,
  padLeftZeros,
  getTxData,
  decodeData,
  broadcast,
  tronWeb,
  initContracts,
  getMsigContract,
  rl,
  fs,
};

