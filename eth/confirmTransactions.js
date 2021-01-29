//call node confirmTransaction <file-of-txs-to-process>
'use strict'

const myArgs = process.argv.slice(2)
const config = require('./ethConfig.json')

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(config.web3url))

const Transport = require('@ledgerhq/hw-transport-node-hid').default
const AppEth = require('@ledgerhq/hw-app-eth').default
const EthereumTx = require('ethereumjs-tx').Transaction
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

//const gasPrice = '0x'+config.gasPrice.toString(16)
let gasPrice
const gasLimit = '0x'+config.gasLimit.toString(16)
const contract_address = config.contract_address
//const amount = config.amount
const amount = '0x00'

//= =============
const createLedger = async () => {
  console.log('Ledger initialized')
  const transport = await Transport.create()
  return new AppEth(transport)
}


function padLeftZeros (stringItem) {
  return new Array(64 - stringItem.length + 1).join('0') + stringItem
}

function getTxHex (nonce, data) {
  var txParams = {
    nonce: '0x'+nonce.toString(16),
    gasPrice: gasPrice,
    gasLimit: gasLimit,
    to: contract_address,
    value: amount,
    data: data,
  }

  var networkId = 1 //'mainnet'

  var txo = new EthereumTx(txParams, { chain: networkId})

  // Set the EIP155 bits
  txo.raw[6] = Buffer.from([networkId]); // v
  txo.raw[7] = Buffer.from([]); // r
  txo.raw[8] = Buffer.from([]); // s

  return txo
}

const sign = async function (ledger, tx, nonce) {
  // construct the data packet for confirming a tx
  var data = '0xc01a8c84' + padLeftZeros(parseInt(tx).toString(16))
  var txo = getTxHex(nonce, data)
  var rawtx = txo.serialize().toString('hex')

  console.log('\nRequesting Ledger Sign: Nonce: \x1b[32m%s\x1b[0m, TX: \x1b[32m%s\x1b[0m, InputData: \x1b[32m%s\x1b[0m',nonce,tx,data,)
  try {
    var result = await ledger.signTransaction(config.hd_path, rawtx)
  } catch (err) {
    console.log("Sign Operation Error: \x1b[32m%s\x1b[0m",err.message)
    return
  }

  // Store signature in transaction
  txo.v = Buffer.from(result.v, "hex");
  txo.r = Buffer.from(result.r, "hex");
  txo.s = Buffer.from(result.s, "hex");

  console.log('---------------Begin Verification Checks---------------')
  console.log('Sending Address: \x1b[32m%s\x1b[0m','0x'+txo.getSenderAddress().toString('hex'))
  console.log('Valid Signature:',txo.verifySignature(),', Valid Gas Estimates:',txo.validate())
  var signedtx = '0x'+txo.serialize().toString('hex')
  console.log('Signed Hex: \x1b[32m%s\x1b[0m',signedtx)

  await broadcast(signedtx);
}

async function broadcast (signedtx) {
  return new Promise(function(resolve,reject){
    rl.question('\nConfirm TX information and Broadcast? [y/n]: ', async function (answer) {
      if (answer !== 'y') {
        console.log('Aborting')
      } else {
        //broadcast final tx
        console.log("Broadcasting...")
        try {
          await web3.eth.sendSignedTransaction(signedtx, function(err, hash) {
            if (!err) {
              console.log(hash);
            } else {
              console.log(err);
            }
          });
        } catch (err) {
          console.log("Broadcast Failed: \x1b[32m%s\x1b[0m",err)
        }
      }
      resolve(answer)
    })
  })
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
    const ethGasStationData = await request
      .get({
        url: 'https://ethgasstation.info/json/ethgasAPI.json',
        json: true
      })
    gasPrice = ethGasStationData.fast * 10 ** 8
    let nonce = await web3.eth.getTransactionCount(config.signerAddress)
    console.log('nonce, gasPrice:')
    console.log(nonce, gasPrice)

    const ledger = await createLedger()
    try {
      for (const tx of txs) {
        await sign(ledger, tx, nonce)
        nonce++
      }
    } catch (err) {
      console.log(err)
    }
    console.log('Finished')
    console.log('Closing Ledger...')
    process.exit(1)
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
})
