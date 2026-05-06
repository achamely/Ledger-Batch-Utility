'use strict'

const {
  createLedger,
  padLeftZeros,
  getTxData,
  broadcast,
  tronWeb,
  initContracts,
  getMsigContract,
  queueBundleTx,
  isValidUuidV4,
  askQuestion,
  fs,
} = require('./common');

const { processList } = require('./helperQueryManagement');
const { randomUUID } = require('crypto');

const config = require('./tronConfig.json')
const myArgs = process.argv.slice(2)

let bundle_uuid = randomUUID();

const sign = async function (ledger, tx, bundleFlag) {
  const args = tx.split(' ')
  let token, instruction, encodedAddr

  let tSym = args[0].toUpperCase();
  let action = args[1].toLowerCase();
  let functions = [];

  switch (tSym) {
    case 'USDT':
      token = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
      functions=['issue','redeem','transfer','freeze','unfreeze','destroy']
      break
    case 'CNHT':
      token = 'TCfCGjekyqmdYt1yxfUM5v5SDtaY6tuWik'
      functions=['mint','redeem','transfer','freeze','unfreeze','destroy']
      break
    case 'MXNT':
      token = 'TDp7Kbp6ajeWeQN9J57Vnw4WyQdKpuARDF'
      functions=['mint','redeem','transfer','freeze','unfreeze','destroy']
      break
    case 'XAUT':
      token = 'TQdCxWJSzJJX7CcTzS7suoX7yTjStGJFru'
      functions=['mint','redeem','transfer','freeze','unfreeze','destroy']
      break
    case 'PROXYADMIN' || 'PA':
      token = 'TCCf77hjPZVXBaeGFv39h5oBMKd2z1D69b'
      functions=['proxy-upgrade']
      break
    case 'SEGREGATEDTREASURY' || 'ST':
      token = 'TVWi2AJhX4PSnVVkLogCHdCx7GfZsMi1RS'
      functions=['pause','unpause','addowner','removeowner','setreceiveaddress','withdraw']
      break
    default:
      console.log('Invalid Token option: ',tSym,' for tx: \n',tx);
      return
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
    case 'pause':
      instruction = '8456cb59'
      break
    case 'unpause':
      instruction = '3f4ba83a'
      break
    case 'addowner':
      encodedAddr = tronWeb.address.toHex(args[2]).toLowerCase()
      instruction = '7065cb48' + padLeftZeros(encodedAddr)
      break
    case 'removeowner':
      encodedAddr = tronWeb.address.toHex(args[2]).toLowerCase()
      instruction = '173825d9' + padLeftZeros(encodedAddr)
      break
    case 'withdraw':
      instruction = '2e1a7d4d' + padLeftZeros(parseInt(args[2]).toString(16))
      break
    case 'setreceiveaddress':
      encodedAddr = tronWeb.address.toHex(args[2]).toLowerCase()
      instruction = 'a69fe8c7' + padLeftZeros(encodedAddr)
      break
    default:
      console.log('Invalid action: ',action,' for tx: \n',tx);
      return
  }
  const data = `0x${instruction}`
  var txo = await getTxData('submit', data, token, bundleFlag)
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

  if (bundleFlag) {
    await queueBundleTx(txo.transaction,bundle_uuid)
  } else {
    await broadcast(txo.transaction)
  }
}

async function main() {

  let methodList = [];
  var dangerFlag = false;
  var dangerOwnerFlag = false;

  let bundleFlag=false;
  for (let i = 0; i < myArgs.length; ) {
    const arg = myArgs[i];

    if (arg.toString().startsWith('--')) {
      const key = arg.slice(2).toLowerCase();
      myArgs.splice(i,1);

      if (key=='dangerous') {
        dangerFlag=true;
        continue;
      }
      if (key=='dangerous-ownership') {
        dangerOwnerFlag=true;
        continue;
      }
      if (key=='b') {
        bundleFlag=true;
        let uuid = myArgs[i];
        if (isValidUuidV4(uuid)) {
          bundle_uuid = uuid;
          myArgs.splice(i,1);
        }
        continue;
      }
    }
    i++;
  }

  if (bundleFlag) {
    console.log("\n\n----------------------------------------------");
    console.log("Bundle Cache Generation: \x1b[32m Enabled\x1b[0m");
    console.log(`Using Bundle Cache ID: \x1b[33m ${bundle_uuid} \x1b[0m`);
    console.log("----------------------------------------------\n\n");
  }

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


  for (const tx of txs) {
    if (!tx.startsWith('#')) {
      let data = tx.split(' ');
      let method = data[1];
      !methodList.includes(method) && methodList.push(method);
    }
  }

  console.log('\n\n');
  for (const method of methodList) {
    switch (method) {
      case 'freeze': case 'unfreeze':
      case 'addBlackList': case 'addToBlockedList': case 'removeBlackList': case 'removeFromBlockedList':
       continue;
      case 'addOwner': case 'removeOwner': case 'replaceOwner': case 'setThreshold': case 'transferOwnership': case 'claimOwnership':
        if (dangerOwnerFlag) {
          console.log("\x1b[33mNotice: Change Owner method found with \x1b[32m--dangerous-ownership \x1b[33mflag\x1b[0m");
          continue;
        } else {
          console.log("\x1b[35mAlert: \x1b[31mChange Owner\x1b[35m method found without \x1b[31m--dangerous-ownership \x1b[35mflag\x1b[0m");
          console.log("\x1b[35mExiting: Please rerun with \x1b[31m--dangerous-ownership \x1b[35mflag if you REALLY WANT TO CHANGE OWNER\x1b[0m");
          console.log('\n\n');
          process.exit(1);
        }
      default:
         if (dangerFlag) {
          console.log(`\x1b[33mNotice: ${method} method found with \x1b[32m--dangerous \x1b[33mflag\x1b[0m`);
          continue;
        } else {
          console.log(`\x1b[35mAlert: Dangerous method \x1b[31m${method}\x1b[35m found without \x1b[31m--dangerous \x1b[35mflag\x1b[0m`);
          console.log("\x1b[35mExiting: Please rerun with \x1b[31m--dangerous \x1b[35mflag if you want to proceed.\x1b[0m");
          console.log('\n\n');
          process.exit(1);
        }
    }
  }


  const answer = await askQuestion('\nIs the configuration correct? [y/n]: ');

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
          await sign(ledger, tx, bundleFlag)
        }
      }
    } catch (err) {
      console.log(err)
    }

    //give time for final broadcast to finish
    console.log('Closing Ledger...')
    await new Promise(resolve => setTimeout(resolve, 3000));
    if (!bundleFlag) {
      await processList([txCountS],false,true,false);
      let txCountF = parseInt(await msigContract.transactionCount().call()) - 1;
      console.log('\nMsig txs: ',txCountS,' - ',txCountF,' ready')
    }
    console.log('Finished')
    process.exit()
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}

main();
