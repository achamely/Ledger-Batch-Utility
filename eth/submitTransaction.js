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

const contractAddress = config.contract_address
// const amount = config.amount
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
    nonce: '0x' + nonce.toString(16),
    gasPrice: gasPrice,
    gasLimit: gasLimit,
    to: contractAddress,
    value: amount,
    data: data
  }

  var networkId = 1 // 'mainnet'

  var txo = new EthereumTx(txParams, { chain: networkId })

  // Set the EIP155 bits
  txo.raw[6] = Buffer.from([networkId]) // v
  txo.raw[7] = Buffer.from([]) // r
  txo.raw[8] = Buffer.from([]) // s

  return txo
}

const sign = async function (ledger, tx, nonce) {
  const args = tx.split(' ')
  let token, instruction
  switch (args[0]) {
    case 'USDT':
      token = 'dac17f958d2ee523a2206206994597c13d831ec7'
      break
    case 'XAUT':
      token = '4922a015c4407f87432b179bb209e125432e4a2a'
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
      instruction = 'a9059cbb' + padLeftZeros(args[2].substr(2).toLowerCase()) + padLeftZeros(parseInt(args[3]).toString(16))
      break
    case 'freeze':
      instruction = '0ecb93c0000000000000000000000000' + args[2].substr(2).toLowerCase()
      break
    case 'unfreeze':
      instruction = 'e4997dc5000000000000000000000000' + args[2].substr(2).toLowerCase()
      break
    case 'destroy':
      instruction = 'f3bdc228000000000000000000000000' + args[2].substr(2).toLowerCase()
      break
  }
  // for a transfer needs to be 44 instead of 24
  const lengthParam = tx.length > 70 ? 44 : 24
  const data = `0xc6427474000000000000000000000000${token}0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000${lengthParam}${instruction}`
  var txo = getTxHex(nonce, data)
  var rawtx = txo.serialize().toString('hex')

  console.log('\nRequesting Ledger Sign: GasPrice: \x1b[32m%s\x1b[0m GWei, Nonce: \x1b[32m%s\x1b[0m, TX: \x1b[32m%s\x1b[0m, InputData: \x1b[32m%s\x1b[0m',gasPrice/1e9,nonce,tx,data,)
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
}


async function updateGas () {
    //const ethGasStationData = await request
    //  .get({
    //    url: 'https://ethgasstation.info/json/ethgasAPI.json',
    //    json: true
    //  })
    // < 2 minutes
    //gasPrice = ethGasStationData.fast * 10 ** 8
    // < 5 minutes  gasPrice * 90% * 10^8 wei units
    //gasPrice = ethGasStationData.average * 10 ** 8
    //gasPrice = ethGasStationData.average * 0.9 * 10 ** 8
    // < 30 minutes
    //gasPrice = ethGasStationData.safeLow * 10 ** 8

    ethGasStationData = await request
      .get({
        url: 'https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey='+apikey,
        json: true
      })
    if (ethGasStationData.status == 1) {
      gasPrice = ethGasStationData.result.SafeGasPrice * 10 ** 9
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

async function broadcast (signedtx) {
    //broadcast final tx
    console.log("Broadcasting...")
    try {
      await web3.eth.sendSignedTransaction(signedtx, async function(err, hash) {
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

    //var options = {
    //  uri: "https://api.etherscan.io/api",
    //  qs: {
    //    module: 'proxy',
    //    action: 'eth_sendRawTransaction',
    //    hex: signedtx,
    //    apikey: apikey
    //  },
    //  json: true
    //}

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


if (myArgs.length > 1) {
  var nonce = parseInt(myArgs[1])
  config.startingNonce = nonce
  console.log("Using NONCE from Command Line: \x1b[32m%s\x1b[0m",nonce)
} else {
  var nonce = config.startingNonce
  console.log("Using NONCE from blockchain: \x1b[32m%s\x1b[0m",nonce)
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
        await updateGas()
        await sign(ledger, tx, nonce)
        nonce++
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
