//call node confirmTransaction.js <file-of-txs-to-process>
'use strict'

const myArgs = process.argv.slice(2)
const config = require('./tronConfig.json')

const TronWeb = require('tronweb')
const tronWebOptions = {
  fullHost: config.fullHostURL
}
if (!(config.trongridApiKey === null || config.trongridApiKey.trim() === '')) {
  tronWebOptions.headers = { "TRON-PRO-API-KEY": config.trongridApiKey }
}
const tronWeb = new TronWeb(tronWebOptions);

const Transport = require('@ledgerhq/hw-transport-node-hid').default
const AppTrx = require('@ledgerhq/hw-app-trx').default
const request = require('request-promise')

const { createInterface } = require('readline')
const rl = createInterface(process.stdin, process.stdout)

const fs = require('fs')

let filePath
if (myArgs.length > 0) {
  filePath = myArgs[0]
} else {
  filePath = config.filePath
}

const txs = fs.readFileSync(filePath).toString().split(/[\n,]+/).filter(Boolean)

const contractAddress = config.contract_address

//==============
const createLedger = async () => {
  console.log('Ledger initialized')
  const transport = await Transport.create()
  return new AppTrx(transport)
}

function padLeftZeros (stringItem) {
  return new Array(64 - stringItem.length + 1).join('0') + stringItem
}

const getTxHex = async function (tx) {
  var parameter = [{type:'uint256',value:tx}];
  var options = {
        feeLimit:config.feeLimit,
        callValue:0
    };
  let sc,signer
  sc = tronWeb.address.toHex(contractAddress).toLowerCase();
  signer = tronWeb.address.toHex(config.signerAddress).toLowerCase();
  const txo = await tronWeb.transactionBuilder.triggerSmartContract(sc, "confirmTransaction(uint256)", options,  parameter, signer);
  return txo
}

const sign = async function (ledger, tx) {
  // construct the data packet for confirming a tx
  var txo = await getTxHex(tx)
  var rawtx = txo.transaction.raw_data_hex
  var txHash = txo.transaction.txID

  console.log('\nRequesting Ledger Sign: TX: \x1b[32m%s\x1b[0m, \nTxHash: \x1b[32m%s\x1b[0m',tx,txHash)
  try {
    var result = await ledger.signTransactionHash(config.hd_path, txHash)
  } catch (err) {
    console.log("Sign Operation Error: \x1b[32m%s\x1b[0m",err.message)
    return
  }

  // Store signature in transaction
  txo.transaction.signature=[result];

  var sender = tronWeb.address.fromHex(txo.transaction.raw_data.contract[0].parameter.value.owner_address)
  var dstContract = tronWeb.address.fromHex(txo.transaction.raw_data.contract[0].parameter.value.contract_address)
  console.log('Sending Address: \x1b[32m%s\x1b[0m',sender)
  console.log('Destination Contract: \x1b[32m%s\x1b[0m',dstContract)
  console.log('Signature: \x1b[32m%s\x1b[0m',txo.transaction.signature)
  if (sender != config.signerAddress) {
    console.log('Sending Address Verification Failed. Expecting: \x1b[32m%s\x1b[0m',config.signerAddress)
    return
  }
  if (dstContract != config.contract_address) {
    console.log('Destination Contract Verification Failed. Expecting: \x1b[32m%s\x1b[0m',token)
    return
  }

  await broadcast(txo.transaction);
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

console.log('Config:')
console.log(config)
console.log('txs:')
console.log(txs)

rl.question('\nIs the configuration correct? [y/n]: ', async function (answer) {
  if (answer !== 'y') {
    console.log('Exiting')
    return process.exit(1)
  }

  console.log('Initializing....')

  try {
    const ledger = await createLedger()

    try {
      for (const tx of txs) {
        await sign(ledger, tx)
      }
    } catch (err) {
      console.log(err)
    }
    //give time for final broadcast to finish
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Finished')
    console.log('Closing Ledger...')
    process.exit(1)
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
})
