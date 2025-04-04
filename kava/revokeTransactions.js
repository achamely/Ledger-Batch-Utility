'use strict'

const FeeMarketEIP1559Transaction = require('@ethereumjs/tx').FeeMarketEIP1559Transaction
const LegacyTransaction = require('@ethereumjs/tx').LegacyTransaction
const bytesToHex = require('@ethereumjs/util').bytesToHex
const AppEth = require('@ledgerhq/hw-app-eth').default

const Chain = require('@ethereumjs/common').Chain
const Hardfork = require('@ethereumjs/common').Hardfork
const Common  = require('@ethereumjs/common').Common
const RLP = require('@ethereumjs/rlp')

//Default Ethereum Mainnet = 1
const chainId = 2222
//const common = new Common({ chain: chainId, hardfork: Hardfork.London, eips: [1559]})
const common = Common.custom({ chainId: chainId})

const config = require('./ethConfig.json')
const myArgs = process.argv.slice(2)

const Web3 = require('web3').Web3
const web3 = new Web3(new Web3.providers.HttpProvider(config.web3url))

const Transport = require('@ledgerhq/hw-transport-node-hid').default
const request = require('request-promise')

const ledgerService = require('@ledgerhq/hw-app-eth').ledgerService

const createLedger = async () => {
  console.log('Ledger initialized')
  const transport = await Transport.create()
  return new AppEth(transport)
}


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

const gasLimit = config.gasLimit
let gasPrice
let maxFeePerGas
let ethGasStationData

const contractAddress = config.contract_address

//= =============
function padLeftZeros (stringItem) {
  return new Array(64 - stringItem.length + 1).join('0') + stringItem
}

function getTxData (nonce, data) {

  var txData = {
    data: data,
    nonce: web3.utils.toHex(nonce),
    gasPrice: web3.utils.toHex(gasPrice),
    gasLimit: web3.utils.toHex(gasLimit),
    to: contractAddress,
    value: '0x00',
    r: web3.utils.toHex(chainId),
    v: '0x',
    s: '0x',
    //type: '0x02'
  }

  return txData
}

const sign = async function (ledger, tx, nonce) {
  // construct the data packet for confirming a tx
  var data = '0x20ea8d86' + padLeftZeros(parseInt(tx).toString(16))
  var txData = getTxData(nonce, data)
  var txo = LegacyTransaction.fromTxData(txData, { common })
  var rawtx = txo.getMessageToSign()

  console.log('\nRequesting Ledger Sign: GasPrice: \x1b[32m%s\x1b[0m nAvax, Nonce: \x1b[32m%s\x1b[0m, TX: \x1b[32m%s\x1b[0m, InputData: \x1b[32m%s\x1b[0m',gasPrice/10e8,parseInt(nonce),tx,data,)
  let result
  try {
/*
      let loadConfig={
      nftExplorerBaseURL: "https://nft.api.live.ledger.com/v1/ethereum",
      pluginBaseURL: "https://cdn.live.ledger.com",
      extraPlugins: null,
      cryptoassetsBaseURL: "https://cdn.live.ledger.com/cryptoassets",
    }
    let resolutionConfig = {
      nft: true,
      erc20: true,
      externalPlugins: true,
    };
*/
    let resolution = {
      nfts: [],
      erc20Tokens: [],
      externalPlugin: [],
      plugin: [],
      domains: []
    }
    //const resolution = await ledgerService.resolveTransaction( bytesToHex(rawtx).substring(2),{},{})
    result = await ledger.signTransaction(config.hd_path, RLP.encode(rawtx), resolution)
    //console.log(result)
  } catch (err) {
    console.log("Sign Operation Error: \x1b[32m%s\x1b[0m",err.message)
    return
  }

  // Store signature in transaction
  txData['v'] = '0x'+result['v']
  txData['r'] = '0x'+result['r']
  txData['s'] = '0x'+result['s']
  var signedTx = LegacyTransaction.fromTxData(txData, { common })

  console.log('---------------Begin Verification Checks---------------')
  console.log('Sending Address: \x1b[32m%s\x1b[0m',signedTx.getSenderAddress().toString('hex'))
  //console.log('Valid Signature:',signedTx.verifySignature(),', Valid Gas Estimates:',signedTx.isValid())
  console.log('Valid Signature:',signedTx.verifySignature())
  var signedHex = bytesToHex(signedTx.serialize())
  console.log('Signed Hex: \x1b[32m%s\x1b[0m',signedHex)

  console.log("Broadcasting...")
  //await broadcastSnowtrace(signedHex)
  await broadcast(signedHex)
}


async function updateGas () {
    let ethGasStationData = await request
      .post({
        url: 'https://evm.kava.io',
        body: {
          method: 'eth_gasPrice',
          id: 1,
          jsonrpc: '2.0',
          params: []
        },
        json: true
      })
    if (ethGasStationData.id == 1) {
      gasPrice = parseInt(ethGasStationData.result)
    } else {
      await new Promise(resolve => setTimeout(resolve, 4000));
      await updateGas()
    }
}

async function broadcast (signedtx) {
    //broadcast final tx
    try {
      await web3.eth.sendSignedTransaction(signedtx, async function(err, hash) {
        if (!err) {
          console.log(hash);
        } else {
          console.log(err);
        }
      });
    } catch (err) {
      if (!err.message.includes("already known")) {
        console.log("Broadcast Failed: \x1b[32m%s\x1b[0m",err)
      }
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
    let signer = await ledger.getAddress(config.hd_path)
    let nonce = await web3.eth.getTransactionCount(signer.address)
    console.log("Signing Address:", signer.address)
    console.log("Using NONCE from blockchain: \x1b[32m%s\x1b[0m",nonce)

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
