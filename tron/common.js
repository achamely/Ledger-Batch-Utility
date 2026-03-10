'use strict'

const Transport = require('@ledgerhq/hw-transport-node-hid').default;
const AppTrx = require('@ledgerhq/hw-app-trx').default;
const request = require('request-promise');
const { TronWeb } = require('tronweb');

const { createInterface } = require('readline');
const fs = require('fs');


const rl = createInterface(process.stdin, process.stdout);
const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};


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

function isValidUuidV4(uuid) {
  const uuidV4Regex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  return uuidV4Regex.test(uuid);
}

async function getTxData (type,data,dest,bundleFlag) {
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
  if (bundleFlag) {
    //extend tx validity by 23.5 hours for txs bundled/stored in cache
    //max network allows is 24hrs from current block timestamp
    //use a little less to avoid TRANSACTION_EXPIRATION_ERROR
    txo.transaction = await tronWeb.transactionBuilder.extendExpiration(txo.transaction,84600);
  }
  return txo
}

async function decodeBundleTxs(txList){
  let retval=[]
  let nextTx = '-';
  try {
    nextTx = parseInt(await msigContract.transactionCount().call());
  } catch (err) {
    console.log(`Tried to get transaction count for contract ${msigContractAddress}, but got err: ${err}`);
  }

  for (const dtx of txList){
    let chainInfo = await tronWeb.trx.getTransactionInfo(dtx.txID)
    let chainStatus = 'Offline'
    if (chainInfo.receipt !== undefined) {
      chainStatus = chainInfo.receipt.result;
    }
    let dest = tronWeb.address.fromHex(dtx.raw_data.contract[0].parameter.value.contract_address);
    let data = dtx.raw_data.contract[0].parameter.value.data;
    let from = tronWeb.address.fromHex(dtx.raw_data.contract[0].parameter.value.owner_address);
    let dd = decodeData('0x'+data);
    if (dd['method']=='submitTransaction') {
      let destContract = tronWeb.address.fromHex('41'+dd['addr']);
      let exData = '0x'+dd['value'];
      let exDD = decodeData(exData);
      retval.push({
        'msigTx': `${nextTx}*`,
        'destination': destContract,
        'method': exDD['method'],
        'targetAddr' : tronWeb.address.fromHex(exDD['addr']),
        'value': exDD['value'],
        'from' : from,
        'expire': dtx.raw_data.expiration,
        'txid': dtx.txID,
        'chainStatus': chainStatus,
      })
      try {
        nextTx = nextTx + 1;
      } catch (err)  {
        //couldn't figure out next txid
      }
    } else {
      retval.push({
        'msigTx': parseInt(dd['value']),
        'destination': dest,
        'method': dd['method'],
        'targetAddr' : '-',
        'value': 0,
        'from' : from,
        'expire': dtx.raw_data.expiration,
        'txid': dtx.txID,
        'chainStatus': chainStatus,
      })
    }
  }
  return retval;
}

function decodeData(hex) {
  let method,addr,value;

  switch (hex.slice(0,10)) {
    case '0x20ea8d86':
      method = 'revokeConfirmation';
      addr = '';
      value = tronWeb.toDecimal('0x'+hex.slice(10));
      break;
    case '0xc01a8c84':
      method = 'confirmTransaction';
      addr = '';
      value = tronWeb.toDecimal('0x'+hex.slice(10));
      break;
    case '0xc6427474':
      method = 'submitTransaction';
      addr = hex.slice(34,74);
      value = hex.slice(266);
      break;
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
    console.log("Broadcasting...");
    //console.log(signedtx.txID);
    try {
      const receipt = await tronWeb.trx.sendRawTransaction(signedtx);
      //console.log(receipt);
      if (receipt.result) {
        console.log(receipt.transaction.txID);
        return true;
      } else {
        console.log('Error', receipt.code, receipt.txid);
        return false;
      }
    } catch (err) {
      console.log("Broadcast Failed: \x1b[32m%s\x1b[0m",err)
      return false;
    }
}

async function bundleBroadcast (signedtxarray, broadcasted) {
  for (const stx of signedtxarray) {
    let broadcastRetry=5;

    if (broadcasted.includes(stx.txID)) {
      console.log(`${stx.txID} Skipped, Already Broadcast`);
      continue;
    }

    while (broadcastRetry > 0) {
      let res = await broadcast(stx);
      if (res) {
        break;
      }
      //incremental backoff between retries to max of 5 seconds
      let base = 1500
      let backoff = (base * 5/broadcastRetry)
      if (backoff > 5000) {
        backoff = 5000
      }
      await new Promise(resolve => setTimeout(resolve, backoff));
      broadcastRetry--;
    }

    if (broadcastRetry < 1) {
      console.log("Error broadcasting Cached TXs")
      console.log("Please check Cached TXs validity before trying again");
      process.exit(0);
    }
  }
}


function getCFHeaders() {
  return {
    'CF-Access-Client-Id' : config.cfid,
    'CF-Access-Client-Secret' : config.cfsecret
  }
}

async function getBundleCache(uuid) {
  let headers = getCFHeaders();
  try {
    let bundleData = await request.get({
      headers: headers,
      url: `https://tacsrpc.tether.to/rpc?bundle=${uuid}`,
      json: true,
    });
    if (bundleData.rawTxs.size == 0) {
      console.log(`Error, Bundle Cache ${uuid} is empty`);
      //process.exit(1);
    }
    //console.log(bundleData);
    let bundleTxs=[]
    for (const hexString of bundleData.rawTxs){
      let btx = Buffer.from(hexString, 'hex').toString('utf8');
      bundleTxs.push(JSON.parse(btx))
    }
    return bundleTxs
  } catch (err) {
    console.log("Error Retrieving Bundle Cache; ", err.message)
    return []
  }
}

async function clearBundleCache(uuid,txs) {
  let rpcurl=`https://tacsrpc.tether.to/rpc?bundle=${uuid}`;
  let headers = getCFHeaders()

  try {
    let response = await request.post({
      headers: headers,
      url: rpcurl,
      body: {
        jsonrpc: '2.0',
        method: 'clearBundle',
        params: txs,
        id: 1,
      },
      json: true,
    });
    if (response.error) {
      console.log('Bundle Clear Error:', response.error.message);
    } else {
      console.log(response.result);
    }
  } catch (err) {
    console.log("Bundle Clear Failed: \x1b[32m%s\x1b[0m",err)
  }
}

async function queueBundleTx(signedtx, bUUID) {

  let signedtxhex = Buffer.from( JSON.stringify(signedtx), 'utf8').toString('hex');

  let headers = { 'content-type': 'application/json' }
  let rpcurl=`https://tacsrpc.tether.to/rpc?bundle=${bUUID}`;
  headers = Object.assign(headers, getCFHeaders())
  console.log(
    "Queueing transaction in Bundle: \x1b[32m%s\x1b[0m",
    bUUID
  );

  try {
    const response = await request.post({
      headers: headers,
      url: rpcurl,
      body: {
        jsonrpc: '2.0',
        method: 'storeRawTransaction',
        params: [signedtxhex],
        id: 1,
      },
      json: true,
    });

    if (response.error) {
      console.log('Bundle Queue Error:', response.error.message);
    } else {
      console.log(response.result);
      console.log("TX inserted into Bundle Cache");
      return response.result;
    }
  } catch (err) {
    console.log(
      "Bundle Queue Error: \x1b[32m%s\x1b[0m",
      err?.message || err
    );
    throw err;
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
  getBundleCache,
  clearBundleCache,
  queueBundleTx,
  bundleBroadcast,
  decodeBundleTxs,
  isValidUuidV4,
  askQuestion,
  rl,
  fs,
};

