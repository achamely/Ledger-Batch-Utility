'use strict'

const {
  createLedger,
  padLeftZeros,
  getTxData,
  broadcast,
  tronWeb,
  initContracts,
  getBundleCache,
  clearBundleCache,
  queueBundleTx,
  bundleBroadcast,
  decodeBundleTxs,
  askQuestion,
  fs,
} = require('./common');

const { processList } = require('./helperQueryManagement');
const config = require('./tronConfig.json');
let txs;
let uuid;

const sign = async function (ledger, tx, action, bundleFlag) {
  // construct the data packet for confirming a tx
  var txo = await getTxData(action,tx,'',bundleFlag)
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

  if (bundleFlag) {
    await queueBundleTx(txo.transaction,uuid)
  } else {
    //await broadcast(txo.transaction)
  }
}


async function main() {
  const myArgs = process.argv.slice(2)

  var bundleFlag=false;
  for (let i = 0; i < myArgs.length; ) {
    const arg = myArgs[i];

    if (arg.toString().startsWith('--')) {
      const key = arg.slice(2).toLowerCase();
      myArgs.splice(i,1);

      if (key=='b') {
        bundleFlag=true;
        uuid = myArgs[i];
        myArgs.splice(i,1);
        continue;
      }
    }
    i++;
  }

  let action = myArgs[0] || '';
  action = action.toLowerCase();

  if ( !['confirm','revoke','broadcast','clear','display'].includes(action) || myArgs.length < 1 || (myArgs.length < 2 && action == 'broadcast' && !bundleFlag) ) {
    console.log("\x1b[31m Invalid Syntax. Please call with following format: \x1b[0m");
    console.log("\x1b[32m    node manageTransactions.js display --b <bundle UUID>\x1b[0m\n");
    console.log("                       or\n");
    console.log("\x1b[32m    node manageTransactions.js broadcast --b <bundle UUID>\x1b[0m\n");
    console.log("                       or\n");
    console.log("\x1b[32m    node manageTransactions.js clear --b <bundle UUID>\x1b[0m\n");
    console.log("                       or\n");
    console.log("\x1b[32m    node manageTransactions.js clear 3,4,5 --b <bundle UUID>\x1b[0m\n");
    console.log("                       or\n");
    console.log("\x1b[32m    node manageTransactions.js <action> <filepath || tx || csv_list_of_txs>\x1b[0m");
    console.log(" Valid options for action are \x1b[35m'confirm'\x1b[0m or \x1b[35m'revoke'\x1b[0m");
    console.log(" Examples:")
    console.log("\x1b[32m    node manageTransactions.js confirm txs.to_confirm \x1b[0m");
    console.log(" or")
    console.log("\x1b[32m    node manageTransactions.js revoke 2000,2001 \x1b[0m");
    process.exit(0);
  }

  let bbText = bundleFlag? 'Enabled' : 'Disabled';
  console.log('\n-------------------------------------------------');
  console.log(`Bundle Operations \x1b[33m${bbText}\x1b[0m`);
  console.log('-------------------------------------------------\n');

  if (bundleFlag) {
    await initContracts();
    let bundleTxs = await getBundleCache(uuid);

    if (bundleTxs.length==0) {
      console.log('Please double check UUID, No Txs in Bundle')
      process.exit(0)
    }

    let signedtxarray = bundleTxs.reverse();
    let decodedPending = await decodeBundleTxs(signedtxarray);
    let bsigners={}

    console.log("\x1b[33mFound the following pending transactions in the Bundle Cache\n\x1b[0m");
    console.log("==========================================================\x1b[33m*PENDING\x1b[0m==================================================================================================================");
    console.log("Tx Expires, \tIndex, \tTX, \tDestination, \t\t\t\tMethod, \t\tAddress, \t\t\t\tValue, \tSender")

    let ptl = decodedPending.length;
    let expired = false;
    let broadcasted = []
    decodedPending.forEach(pTx => {
      let output = "";
      let status = 'Unknown'
      let ttl = pTx['expire'] - Date.now();

      if (pTx['chainStatus'] == 'Offline') {
        if (ttl > 0) {
          output +=`\x1b[33m`;
          let hr = Math.floor(ttl / 1000 / 3600)
          let min = Math.floor(ttl / 1000 / 60) % 60;
          status = `   ${hr}h ${min}m`;
        } else {
          status = '   Expired';
          expired = true;
          output +=`\x1b[31m`
        }
      } else {
        status = pTx['chainStatus'];
        output +=`\x1b[36m`
        broadcasted.push(pTx.txid);
      }

      output +=`${status},`;
      output +=`\t ${ptl},`;
      output +=`\t${pTx['msigTx']},`;
      output +=`\t${pTx['destination']},`;
      output +=`\t${pTx['method']},`;
      if(pTx['targetAddr'].length <30) {
        output +=`\t${pTx['targetAddr']},\t\t\t\t`;
      } else {
        output +=`\t\t${pTx['targetAddr']},`;
      }
      output +=`\t${pTx['value']},`;
      output +=`\t${pTx['from']}`;
      output +=`\x1b[0m`;

      console.log(output);
      ptl--;
    })
    console.log("====================================================================================================================================================================================\n\n");
    console.log("\x1b[36mNote: the displayed Pending MultiSig TX Number* is calculated. If another multisig tx is submitted before this bundle, this will change.");
    console.log("To avoid confirmation issues in bundle, Please ensure this bundle is broadcasted before submitting new msig txs to the blockchain.\n\n\n\x1b[0m")

    if (action == 'display') {
      return process.exit(0);
    }

    if (action == 'broadcast') {
      if (expired) {
        console.log("Bundle includes \x1b[31mexpired txs\x1b[0m, can not broadcast");
        console.log("Please remove expired txs, or submit a new bundle.\n\n");
        process.exit(0);
      }
      const bq = await askQuestion('\nBroadcast Bundle Txs to Blockchain? [y/n] ');
      if (bq === 'y') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await bundleBroadcast(signedtxarray, broadcasted);
        console.log('Finished');
      } else {
        console.log("Exiting");
      }
      return process.exit(0);
    }

    if (action == 'clear') {
      let txlist_d = 'All Bundle Txs'

      if (myArgs[1] !== undefined) {
        txs = myArgs[1].split(',').filter(Boolean);
        if (txs.length > 0) {
          txlist_d = `Bundle Txs ${txs}`;
        }
      }

      const bq = await askQuestion(`\nDelete ${txlist_d} from Queue? [y/n] `);
      if (bq === 'y') {
        await clearBundleCache(uuid, txs);
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('Finished');
      } else {
        console.log("Exiting");
      }
      return process.exit(0);
    }
  }

  let filePath = myArgs[1];
  if (fs.existsSync(filePath)) {
    txs = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  } else {
    txs = myArgs[1].split(',').filter(Boolean);
  }


  console.log('Config:')
  console.log(config)
  console.log('txs:')
  //console.log(txs)
  let sortedTxs={};
  let data;
  if (txs.length==1) {
    data=[txs,txs]
  } else {
    data=[txs.join(",")]
  }
  await processList(data,true).then(res => {
    res.forEach(subArray => {
      if (subArray.length > 0) {
        const key = subArray[0]; // First element as key
        const value = subArray.slice(1); // Remaining elements as value
        sortedTxs[key] = value; // If only one value, store it as a single value
      }
    });
  });


  console.log(`\nYou are performing ---------- \x1b[35m${action}\x1b[0m ---------- on the above list of transactions.\n`);
  console.log('Please review the configuration and Transaction list\n');
  const answer = await askQuestion(`\nProceed? [y/n]: `);
  if (answer !== 'y') {
    console.log('Exiting')
    return process.exit(1)
  }

  console.log('Initializing....')

  try {
    const ledger = await createLedger()
    const signer = await ledger.getAddress(config.hd_path);
    console.log("Signing Address:", signer.address)

    try {
      for (const tx of txs) {
        if (!tx.startsWith('#')) {
          let txDetails = sortedTxs[tx];
          let executed=false;
          let signers=[];
          if (txDetails) {
            executed = txDetails[4];
            signers = txDetails[5];
          }

          if (!executed) {
            switch (action) {
              case 'confirm':
                if (signers.includes(signer.address)) {
                  console.log("\x1b[36m You have already signed tx: \x1b[33m",tx,"\x1b[0m");
                  continue;
                }
                break
              case 'revoke':
                if (!signers.includes(signer.address)) {
                  console.log("\x1b[36m You have no confirmation to revoke on tx: \x1b[33m",tx,"\x1b[0m");
                  continue;
                }
                break
              default:
                console.log("Unknown action ",action,". Please select either \x1b[35m'confirm'\x1b[0m or \x1b[35m'revoke'\x1b[0m");
                process.exit(0);
            }
            await sign(ledger, tx, action, bundleFlag);
          } else {
            console.log("\x1b[36m Transaction: \x1b[33m",tx,"\x1b[36m already executed\x1b[0m");
          }
        }
      }
    } catch (err) {
      console.log(err)
    }
    //give time for final broadcast to finish
    console.log('Closing Ledger...')
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('Finished')
    console.log("Checking TX Status");
    await processList(data,true);
    process.exit(0)

  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}

main()
