'use strict'

const {
  createLedger,
  padLeftZeros,
  getTxData,
  updateGas,
  broadcastFlashbot,
  bundleRebroadcast,
  web3,
  common,
  FeeMarketEIP1559Transaction,
  bytesToHex,
  ledgerService,
  askQuestion,
  adminMSIG,
  txHashes,
  fs,
} = require('./common');

const { getStatus } = require('./flashbotStatus.js')
const { processList } = require('./helperQueryManagement');
const { randomUUID } = require('crypto');

const config = require('./ethConfig.json');
const request = require('request-promise');
const myArgs = process.argv.slice(2);

const contractAddress = config.contract_address;
const gasLimit = config.gasLimit;
let gasPrice, maxFeePerGas;

const sign = async (ledger, tx, nonce, bundleFlag) => {
  const args = tx.split(' ');
  let tokenAddress, instruction;
  let token = args[0].toUpperCase();
  let action = args[1].toLowerCase();
  let sig1, sig2;

  if ((args[3] != undefined) && (args[3].slice(0,2) == '0x'))  {
    sig1 = args[3]
    console.log('sig1',sig1);
  }

  if ((args[4] != undefined) && (args[4].slice(0,2) == '0x')) {
    sig2 = args[4]
    console.log('sig2',sig2);
  }


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
  const txData = getTxData(nonce, data, gasLimit, gasPrice, maxFeePerGas, contractAddress);
  const txo = FeeMarketEIP1559Transaction.fromTxData(txData, { common });
  const rawtx = txo.getMessageToSign();

  console.log('\nRequesting Ledger Sign: GasPrice: \x1b[32m%s\x1b[0m GWei, Nonce: \x1b[32m%s\x1b[0m, TX: \x1b[32m%s\x1b[0m, InputData: \x1b[32m%s\x1b[0m',gasPrice,parseInt(nonce),tx,data,)

  let result;
  try {
    const resolution = await ledgerService.resolveTransaction(bytesToHex(rawtx).substring(2), {}, {});
    result = await ledger.signTransaction(config.hd_path, rawtx, resolution);
  } catch (err) {
    console.log("Sign Operation Error: \x1b[32m%s\x1b[0m",err.message)
    return;
  }

  // Store signature in transaction
  txData.v = '0x' + result.v;
  txData.r = '0x' + result.r;
  txData.s = '0x' + result.s;
  const signedTx = FeeMarketEIP1559Transaction.fromTxData(txData, { common });

  console.log('---------------Begin Verification Checks---------------')
  console.log('Sending Address: \x1b[32m%s\x1b[0m',signedTx.getSenderAddress().toString('hex'))
  console.log('Valid Signature:',signedTx.verifySignature())
  var signedHex = bytesToHex(signedTx.serialize())
  console.log('Signed Hex: \x1b[32m%s\x1b[0m',signedHex)

  if (sig1 && sig2) {
    console.log(`Broadcasting Signed TX BUNDLE...`);
    let signedtxarray = [bytesToHex(signedTx.serialize()), sig1, sig2]
    console.log(signedtxarray);
    await bundleRebroadcast(signedtxarray);
  } else {
    console.log(`Broadcasting Signed TX...`);
    if (bundleFlag) {
      let uuid=randomUUID();
      await broadcastFlashbot(bytesToHex(signedTx.serialize()),uuid);
    } else {
      await broadcastFlashbot(bytesToHex(signedTx.serialize()));
    }
  }
};

async function main() {

  let bundleFlag=false;
  for (let i = 0; i < myArgs.length; i++) {
    const arg = myArgs[i];
    if (arg.toString().startsWith('--')) {
      const key = arg.slice(2);
      myArgs.splice(i,1)
      if (key.toLowerCase()=='b') {
        bundleFlag=true
      }
    }
  }

  if (bundleFlag) {
    console.log("\n\n----------------------------------------------");
    console.log("Bundle Cache Generation: \x1b[32m Enabled\x1b[0m");
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

  const answer = askQuestion('\nIs the configuration correct? [y/n]: ');
  if (answer !== 'y') {
    console.log('Exiting')
    return process.exit(1)
  }

  console.log('Initializing....')

  try {
    let txCountS = parseInt(await adminMSIG.methods.transactionCount().call())
    const ledger = await createLedger()
    let signer = await ledger.getAddress(config.hd_path)
    let nonce = await web3.eth.getTransactionCount(signer.address)
    console.log("Signing Address:", signer.address)
    console.log("Using NONCE from blockchain: \x1b[32m%s\x1b[0m",nonce)

    try {
      for (const tx of txs) {
        if (!tx.startsWith('#')) {
          ({ gasPrice, maxFeePerGas } = await updateGas());
          await sign(ledger, tx, nonce, bundleFlag);
          nonce++;
        }
      }
    } catch (err) {
      console.log(err)
    }

    //give time for final broadcast to finish
    console.log('Closing Ledger...')
    if (bundleFlag) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Finished')
    } else {
      console.log('Checking Txs status')
      await new Promise(resolve => setTimeout(resolve, 6000));
      await getStatus(txHashes);
      //give time for getStatus to finish after last tx confirms
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Finished')
      await processList([txCountS],false,true,false);
      let txCountF = parseInt(await adminMSIG.methods.transactionCount().call()) - 1;
      console.log('\nMsig txs: ',txCountS,' - ',txCountF,' ready')
    }
    process.exit()
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}

main();
