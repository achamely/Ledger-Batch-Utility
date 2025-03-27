'use strict'

const {
  createLedger,
  padLeftZeros,
  getTxData,
  broadcast,
  tronWeb,
  initContracts,
  getMsigContract,
  rl,
  fs,
} = require('./common');

const { processList } = require('./helperQueryManagement');

const config = require('./tronConfig.json')
const myArgs = process.argv.slice(2)

const sign = async function (ledger, tx) {
  const args = tx.split(' ')
  let token, instruction, encodedAddr

  let tSym = args[0].toUpperCase();
  let action = args[1].toLowerCase();

  switch (tSym) {
    case 'USDT':
      token = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
      break
    case 'CNHT':
      token = 'TCfCGjekyqmdYt1yxfUM5v5SDtaY6tuWik'
      break
    case 'MXNT':
      token = 'TDp7Kbp6ajeWeQN9J57Vnw4WyQdKpuARDF'
      break
    case 'XAUT':
      token = 'TQdCxWJSzJJX7CcTzS7suoX7yTjStGJFru'
      break
    case 'ProxyAdmin':
      token = 'TCCf77hjPZVXBaeGFv39h5oBMKd2z1D69b'
      break
    default:
      console.log('Invalid Token option: ',tSym,' for tx: \n',tx);
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
      encodedAddr = tronWeb.address.toHex(args[2]).toLowerCase()
      instruction = 'a9059cbb' + padLeftZeros(encodedAddr) + padLeftZeros(parseInt(args[3]).toString(16))
      break
    case 'mint':
      encodedAddr = tronWeb.address.toHex(args[2]).toLowerCase()
      instruction = '40c10f19' + padLeftZeros(encodedAddr) + padLeftZeros(parseInt(args[3]).toString(16))
      break;
    case 'freeze':
      encodedAddr = tronWeb.address.toHex(args[2]).toLowerCase()
      if (tSym == 'USDT') {
        //addBlackList
        instruction = '0ecb93c0' + padLeftZeros(encodedAddr)
      } else {
        //addToBlockedList
        instruction = '3c7c9b90' + padLeftZeros(encodedAddr)
      }
      break
    case 'unfreeze':
      encodedAddr = tronWeb.address.toHex(args[2]).toLowerCase()
      if (tSym == 'USDT') {
        //removeBlackList
        instruction = 'e4997dc5' + padLeftZeros(encodedAddr)
      } else {
        //removeFromBlockedList
        instruction = '1a14f449' + padLeftZeros(encodedAddr)
      }
      break
    case 'destroy':
      encodedAddr = tronWeb.address.toHex(args[2]).toLowerCase()
      if (tSym == 'USDT') {
        //destroyBlackFunds
        instruction = 'f3bdc228' + padLeftZeros(encodedAddr)
      } else {
        //destroyBlockedFunds
        instruction = '0e27a385' + padLeftZeros(encodedAddr)
      }
      break
    case 'proxy-upgrade':
      let proxyAddr = tronWeb.address.toHex(args[2]).toLowerCase()
      let implimentationAddr = tronWeb.address.toHex(args[3]).toLowerCase()
      instruction = '99a88ec4' +  padLeftZeros(proxyAddr) + padLeftZeros(implimentationAddr)
      break
    default:
      console.log('Invalid action: ',action,' for tx: \n',tx);
      return
  }
  const data = `0x${instruction}`
  var txo = await getTxData('submit', data, token)
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

async function main() {
  let txs;
  let filePath = myArgs[0];
  if (fs.existsSync(filePath)) {
    txs = fs.readFileSync(filePath, 'utf8').toString().split('\n').filter(Boolean);
  } else {
    txs = [myArgs.join(' ')];
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
    await initContracts();
    let msigContract;
    try {
      msigContract = getMsigContract(); // Fetch initialized contract
    } catch (err) {
      console.error("Error: ", err.message);
      return;
    }

    try {
      let txCountS = parseInt(await msigContract.transactionCount().call());
      const ledger = await createLedger()
      let signer = await ledger.getAddress(config.hd_path)
      console.log("Signing Address:", signer.address)

      try {
        for (const tx of txs) {
          if (!tx.startsWith('#')) {
            await sign(ledger, tx)
          }
        }
      } catch (err) {
        console.log(err)
      }

      //give time for final broadcast to finish
      console.log('Closing Ledger...')
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('Finished')
      await processList([txCountS],false,true,false);
      let txCountF = parseInt(await msigContract.transactionCount().call()) - 1;
      console.log('\nMsig txs: ',txCountS,' - ',txCountF,' ready')
      process.exit()
    } catch (err) {
      console.log(err)
      process.exit(1)
    }
  })
}

main();
