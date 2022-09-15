'use strict'

const config = require('./tronConfig.json')
const myArgs = process.argv.slice(2)

const TronWeb = require('tronweb')
const tronWeb = new TronWeb({
    fullHost: config.fullHostURL,
    headers: { "TRON-PRO-API-KEY": config.trongridApiKey },
});

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

const txs = fs.readFileSync(filePath).toString().split('\n').filter(Boolean)

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

const getTxHex = async function (dest,data) {
  var parameter = [{type:'address',value:dest},{type:'uint256',value:0},{type:'bytes',value:data}];
  var options = {
        feeLimit:config.feeLimit,
        callValue:0
    };
  let sc,signer
  sc = tronWeb.address.toHex(contractAddress).toLowerCase();
  signer = tronWeb.address.toHex(config.signerAddress).toLowerCase();
  const txo = await tronWeb.transactionBuilder.triggerSmartContract(sc, "submitTransaction(address,uint256,bytes)", options,  parameter, signer);
  return txo
}

const sign = async function (ledger, tx) {
  const args = tx.split(' ')
  let token, instruction, encodedAddr
  switch (args[0]) {
    case 'USDT':
      token = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
      break
  }

  switch (args[1]) {
    case 'issue':
      instruction = 'cc872b66' + padLeftZeros(parseInt(args[2]).toString(16))
      break
    case 'redeem':
      instruction = 'db006a75' + padLeftZeros(parseInt(args[2]).toString(16))
      break
    case 'transfer':
      encodedAddr = tronWeb.address.toHex(args[2]).toLowerCase()
      instruction = 'a9059cbb' + padLeftZeros(encodedAddr) + padLeftZeros(parseInt(args[3]).toString(16))
      break
    case 'freeze':
      encodedAddr = tronWeb.address.toHex(args[2]).toLowerCase()
      instruction = '0ecb93c0' +  padLeftZeros(encodedAddr)
      break
    case 'unfreeze':
      encodedAddr = tronWeb.address.toHex(args[2]).toLowerCase()
      instruction = 'e4997dc5' +  padLeftZeros(encodedAddr)
      break
    case 'destroy':
      encodedAddr = tronWeb.address.toHex(args[2]).toLowerCase()
      instruction = 'f3bdc228' +  padLeftZeros(encodedAddr)
      break
  }
  const data = `0x${instruction}`
  var txo = await getTxHex(token, data)
  var rawtx = txo.transaction.raw_data_hex
  var txHash = txo.transaction.txID

  console.log('\nRequesting Ledger Sign: TX: \x1b[32m%s\x1b[0m, \nInputData: \x1b[32m%s\x1b[0m \nTxHash: \x1b[32m%s\x1b[0m',tx,data,txHash)
  console.log('Token Contract: \x1b[32m%s\x1b[0m',token)
  try {
    var result = await ledger.signTransactionHash(config.hd_path, txHash)
  } catch (err) {
    console.log("Sign Operation Error: \x1b[32m%s\x1b[0m",err.message)
    return
  }

  // Store signature in transaction
  txo.transaction.signature=[result];

  console.log('---------------Begin Verification Checks---------------')
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

  await broadcast(txo.transaction)
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
