'use strict'

const config = require('./ethConfig.json')
const myArgs = process.argv.slice(2)

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(config.web3url))

const Transport = require('@ledgerhq/hw-transport-node-hid').default
const AppEth = require('@ledgerhq/hw-app-eth').default
const EthereumTx = require('ethereumjs-tx').Transaction
const request = require('request-promise')

const { createInterface } = require('readline')
const rl = createInterface(process.stdin, process.stdout)

let apikey = config.etherscanApiKey

const fs = require('fs')

let filePath
if (myArgs.length > 0) {
  filePath = myArgs[0]
} else {
  filePath = config.filePath
}

const txs = fs.readFileSync(filePath).toString().split('\n').filter(Boolean)

const gasLimit = '0x' + config.gasLimit.toString(16)
let gasPrice
let ethGasStationData

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

  await broadcastEtherscan(signedtx)
  await broadcast(signedtx);
}

async function updateGas () {
    ethGasStationData = await request
      .get({
        url: 'https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey='+apikey,
        json: true
      })
    if (ethGasStationData.status == 1) {
      //gasPrice = ethGasStationData.result.SafeGasPrice * 10 ** 9
      //gasPrice = ethGasStationData.result.FastGasPrice * 10 ** 9

      //add a little buffer over api to handle slippage
      gasPrice = (ethGasStationData.result.FastGasPrice * 1 + 10) * 10 ** 9
    } else {
      if (ethGasStationData.result == "Invalid API Key"){
        console.log("Invalid Etherscan API Key, fix or remove from config to continue")
        process.exit(1)
      } else {
        await new Promise(resolve => setTimeout(resolve, 4000));
        await updateGas()
      }
    }
}

async function broadcast(signedtx) {
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

async function broadcastEtherscan (signedtx) {
    //broadcast final tx
    console.log("Broadcasting...")

    var options = {
      url: "https://api.etherscan.io/api?module=proxy&action=eth_sendRawTransaction&hex="+signedtx+"&apikey="+apikey,
      json: true
    }

    request(options)
      .then(function (txResult) {
        console.log(txResult.result);
      })
      .catch(function (err) {
        console.log("Broadcast Failed: \x1b[32m%s\x1b[0m",err)
      });
}


async function confirmBroadcast (signedtx) {
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
    const ledger = await createLedger()
    let nonce = await web3.eth.getTransactionCount(config.signerAddress)

    try {
      for (const tx of txs) {
        if (tx[0] != "#") {
          await updateGas()
          await sign(ledger, tx, nonce)
          nonce++
        }
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
