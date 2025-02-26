'use strict'

const FeeMarketEIP1559Transaction = require('@ethereumjs/tx').FeeMarketEIP1559Transaction
const bytesToHex = require('@ethereumjs/util').bytesToHex
const AppEth = require('@ledgerhq/hw-app-eth').default

const Chain = require('@ethereumjs/common').Chain
const Hardfork = require('@ethereumjs/common').Hardfork
const Common  = require('@ethereumjs/common').Common

const { getStatus } = require('./flashbotStatus.js')

//Default Ethereum Mainnet = 1
const chainId = Chain.Mainnet

const common = new Common({ chain: chainId, hardfork: Hardfork.London, eips: [1559]})

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
let txHashes = []

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
    gasLimit: web3.utils.toHex(gasLimit),
    maxPriorityFeePerGas: web3.utils.toHex(gasPrice),
    maxFeePerGas: web3.utils.toHex(maxFeePerGas),
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
  const args = tx.split(' ')
  let tokenAddress, instruction
  let token = args[0].toUpperCase()
  let action = args[1]
  let functions = []
  switch (token) {
    case 'USDT':
      tokenAddress = 'dac17f958d2ee523a2206206994597c13d831ec7'
      functions=['issue','redeem','transfer','mint','freeze','unfreeze','destroy']
      break
    case 'EURT':
      tokenAddress = 'C581b735A1688071A1746c968e0798D642EDE491'
      functions=['issue','redeem','transfer','mint','freeze','unfreeze','destroy']
      break
    case 'XAUT':
      tokenAddress = '68749665ff8d2d112fa859aa293f07a622782f38'
      functions=['issue','redeem','transfer','mint','freeze','unfreeze','destroy']
      break
    case 'AUSDT':
      tokenAddress = '9EEAD9ce15383CaEED975427340b3A369410CFBF'
      functions=['redeem','transfer','mint','freeze','unfreeze','destroy']
      break
    case 'ADMIN':
      tokenAddress = 'C6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828'
      functions=['removeOwner','revokeConfirmation','addOwner','changeRequirement','confirmTransaction','submitTransaction','replaceOwner','executeTransaction']
      break
    case 'ORACLE':
      tokenAddress = '02c65719da4317d84d808740920d6f6285045660'
      functions=['claimOwnership','setOperator','transferOwnership','setMaximumDeltaPercentage','setThreshold','freezeOracle','unfreezeOracle']
      break
    case 'PERMISSIONCONTROL':
      tokenAddress = '316907d43188851d710e49590311c4658d6ad0b3'
      functions=['claimOwnership','setOperator','transferOwnership']
      break
  }

  if (!functions.includes(action)) {
    console.log(`Unsupported function ${action} called on ${token} Contract`)
    return
 }


  switch (action) {
    case 'issue':
      instruction = 'cc872b66' + padLeftZeros(parseInt(args[2]).toString(16))
      break
    case 'redeem':
      instruction = 'db006a75' + padLeftZeros(parseInt(args[2]).toString(16))
      break
    case 'transfer':
      instruction = 'a9059cbb' + padLeftZeros(args[2].substr(2).toLowerCase()) + padLeftZeros(parseInt(args[3]).toString(16))
      break
    case 'mint':
      instruction = '40c10f19' + padLeftZeros(args[2].substr(2).toLowerCase()) + padLeftZeros(parseInt(args[3]).toString(16))
      break;
    case 'freeze':
      if (token == 'USDT') {
        //addBlackList
        instruction = '0ecb93c0' + padLeftZeros(args[2].substr(2).toLowerCase())
      } else {
        //addToBlockedList
        instruction = '3c7c9b90' + padLeftZeros(args[2].substr(2).toLowerCase())
      }
      break
    case 'unfreeze':
      if (token == 'USDT') {
        //removeBlackList
        instruction = 'e4997dc5' + padLeftZeros(args[2].substr(2).toLowerCase())
      } else {
        //removeFromBlockedList
        instruction = '1a14f449' + padLeftZeros(args[2].substr(2).toLowerCase())
      }
      break
    case 'destroy':
      if (token == 'USDT') {
        //destroyBlackFunds
        instruction = 'f3bdc228' + padLeftZeros(args[2].substr(2).toLowerCase())
      } else {
        //destroyBlockedFunds
        instruction = '0e27a385' + padLeftZeros(args[2].substr(2).toLowerCase())
      }
      break
    case 'proxy-upgrade':
      let proxyAddr =  padLeftZeros(args[2].substr(2).toLowerCase())
      let implimentationAddr =  padLeftZeros(args[3].substr(2).toLowerCase())
      instruction = '99a88ec4' +  padLeftZeros(proxyAddr) + padLeftZeros(implimentationAddr)
      break
    case 'addOwner':
      instruction = '7065cb48' + padLeftZeros(args[2].substr(2).toLowerCase())
      break
    case 'removeOwner':
      instruction = '173825d9' + padLeftZeros(args[2].substr(2).toLowerCase())
      break
    case 'replaceOwner':
      instruction = 'e20056e6' + padLeftZeros(args[2].substr(2).toLowerCase()) + padLeftZeros(args[3].substr(2).toLowerCase())
      break
    case 'claimOwnership':
      instruction = '4e71e0c8'
      break
    case 'transferOwnership':
      //disable direct/renounce for now
      direct='0'  //True if `newOwner` should be set immediately. False if `newOwner` needs to use `claimOwnership`.
      renounce='0' //Allows the `newOwner` to be `address(0)` if `direct` and `renounce` is True. Has no effect otherwise.
      instruction = '078dfbe7' + padLeftZeros(direct) + padLeftZeros(renounce)
      break
    case 'freezeOracle':
      instruction = '62a5af3b'
      break
    case 'unfreezeOracle':
      instruciton = '6a28f000'
      break
    case 'setMaximumDeltaPercentage':
      instruction = 'abee062b' + padLeftZeros(parseInt(args[2]).toString(16))
      break
    case 'setOperator':
      let status='0'
      if (args[3]) {
        status='1'
      }
      instruction = '558a7297' + padLeftZeros(args[2].substr(2).toLowerCase()) + padLeftZeros(status)
      break
    case 'setThreshold':
      instruction = 'e5a98603' + padLeftZeros(parseInt(args[2]).toString(16))
      break
  }
  // for a transfer needs to be 44 instead of 24 longer
  //const lengthParam = tx.length > 70 ? 44 : 24
  const lengthParam = args.length > 3 ? 44 : 24
  const data = `0xc6427474000000000000000000000000${tokenAddress}0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000${lengthParam}${instruction}`
  var txData = getTxData(nonce, data)
  var txo = FeeMarketEIP1559Transaction.fromTxData(txData, { common })
  var rawtx = txo.getMessageToSign()

  console.log('\nRequesting Ledger Sign: GasPrice: \x1b[32m%s\x1b[0m GWei, Nonce: \x1b[32m%s\x1b[0m, TX: \x1b[32m%s\x1b[0m, InputData: \x1b[32m%s\x1b[0m',gasPrice,parseInt(nonce),tx,data,)
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
    let resolution = {
      nfts: [],
      erc20Tokens: [],
      externalPlugin: [],
      plugin: [],
      domains: []
    }
*/
    const resolution = await ledgerService.resolveTransaction( bytesToHex(rawtx).substring(2),{},{})
    result = await ledger.signTransaction(config.hd_path, rawtx, resolution)
    //console.log(result)
  } catch (err) {
    console.log("Sign Operation Error: \x1b[32m%s\x1b[0m",err.message)
    return
  }

  // Store signature in transaction
  txData['v'] = '0x'+result['v']
  txData['r'] = '0x'+result['r']
  txData['s'] = '0x'+result['s']
  var signedTx = FeeMarketEIP1559Transaction.fromTxData(txData, { common })

  console.log('---------------Begin Verification Checks---------------')
  console.log('Sending Address: \x1b[32m%s\x1b[0m',signedTx.getSenderAddress().toString('hex'))
  //console.log('Valid Signature:',signedTx.verifySignature(),', Valid Gas Estimates:',signedTx.isValid())
  console.log('Valid Signature:',signedTx.verifySignature())
  var signedHex = bytesToHex(signedTx.serialize())
  console.log('Signed Hex: \x1b[32m%s\x1b[0m',signedHex)

  console.log("Broadcasting...")
  //await broadcastEtherscan(signedHex)
  //await broadcast(signedHex)
  await broadcastFlashbot(signedHex)
}


async function updateGas () {
    ethGasStationData = await request.get({
        url: 'https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey='+apikey,
        json: true
      })
    if (ethGasStationData.status == 1) {
      gasPrice = parseInt(ethGasStationData.result.FastGasPrice) - parseInt(ethGasStationData.result.ProposeGasPrice)
      if (gasPrice < 2) {
        gasPrice = 2
      }
      maxFeePerGas = ((parseInt(ethGasStationData.result.suggestBaseFee) * 2) + gasPrice) * 10e8
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

async function broadcastFlashbot (signedtx) {
  var jsonBody = {
    jsonrpc: "2.0",
    method: "eth_sendRawTransaction",
    params: [signedtx],
    id: 1
  }

  var options = {
    headers: {'content-type' : 'application/json'},
    url: "https://rpc.flashbots.net/fast",
    body: jsonBody,
    json: true
  }

  request.post(options).then(function (txResult) {
    if (txResult.error) {
      console.log("Error: ",txResult.error.message)
    } else {
      console.log(txResult.result);
      txHashes.push(txResult.result);
    }
  }).catch(function (err) {
    console.log("Broadcast Failed: \x1b[32m%s\x1b[0m",err)
  });
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
        console.log("Broadcast Failed: \x1b[32m%s\x1b[0m",err.message)
      }
    }
}


async function broadcastEtherscan (signedtx) {
    //broadcast final tx
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

async function main() {
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
    const adminAbi = await request.get({
      url: 'https://api.etherscan.io/api?module=contract&action=getabi&address='+contractAddress+'&apikey='+apikey,
      json: true
    })
    const adminContract = new web3.eth.Contract(JSON.parse(adminAbi.result),contractAddress)
    let txCountS = parseInt(await adminContract.methods.transactionCount().call())
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
    console.log('Closing Ledger...')
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Finished')
    //console.log(txHashes);
    await getStatus(txHashes)
    let txCountF = parseInt(await adminContract.methods.transactionCount().call())
    console.log('Msig txs: ',txCountS,' - ',txCountF-1,' ready')
    process.exit(1)
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
 })
}

main()
