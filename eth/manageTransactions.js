'use strict';

const {
  createLedger,
  padLeftZeros,
  getTxData,
  decodeBundleTxs,
  updateGas,
  populateNextNonce,
  broadcastFlashbot,
  bundleRebroadcast,
  getBundleCache,
  clearBundleCache,
  web3,
  common,
  FeeMarketEIP1559Transaction,
  bytesToHex,
  ledgerService,
  askQuestion,
  getContractAddress,
  txHashes,
  fs,
} = require('./common');

const { getStatus } = require('./flashbotStatus.js');
const { processList } = require('./helperQueryManagement');

const config = require('./ethConfig.json');

let contractAddress;
const gasLimit = config.gasLimit;
let gasPrice, maxFeePerGas;
let txs;
let uuid;

const sign = async (ledger, tx, nonce, action, bundleFlag, rawFlag) => {
  let inst;
  switch (action) {
    case 'confirm':
      inst='0xc01a8c84'
    break
    case 'revoke':
      inst='0x20ea8d86'
    break
  }
  const data = inst + padLeftZeros(parseInt(tx).toString(16));
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

  txData.v = '0x' + result.v;
  txData.r = '0x' + result.r;
  txData.s = '0x' + result.s;
  const signedTx = FeeMarketEIP1559Transaction.fromTxData(txData, { common });

  console.log('---------------Begin Verification Checks---------------')
  console.log('Sending Address: \x1b[32m%s\x1b[0m',signedTx.getSenderAddress().toString('hex'))
  //console.log('Valid Signature:',signedTx.verifySignature(),', Valid Gas Estimates:',signedTx.isValid())
  console.log('Valid Signature:',signedTx.verifySignature())
  var signedHex = bytesToHex(signedTx.serialize())

  console.log('Signed Hex: \x1b[32m%s\x1b[0m',signedHex)
  if (rawFlag) {
    console.log('\x1b[35m Send signed hex to Bundling admin !!!\x1b[0m');
  } else if (bundleFlag) {
    await broadcastFlashbot(signedHex,uuid);
    console.log('\x1b[35m Please ensure no further txs are prepared/signed/broadcast until this bundle has been broadcast !!!\x1b[0m');
  } else {
    await broadcastFlashbot(signedHex);
  }
};

async function main() {
  const myArgs = process.argv.slice(2);

  var bundleFlag=false;
  var rawFlag=false;
  var simFlag=false;
  console.log(myArgs.length);
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
      if (['r','raw'].includes(key)) {
        rawFlag=true;
        continue;
      }
      if (['s','sim','simulate'].includes(key)) {
        simFlag=true;
        continue;
      }
      if (['c','ca'].includes(key)) {
        contractAddress = myArgs[i].toLowerCase();
        myArgs.splice(i,1);
        continue;
      }
    }
    i++;
  }

  if (bundleFlag && rawFlag) {
    console.log("Note: --r Raw Flag disables submitting to --b Bundle Cache");
  }

  let action = myArgs[0] || '';
  action = action.toLowerCase();

  if ( !['confirm','revoke','broadcast','clear','display'].includes(action) || myArgs.length < 1 || (myArgs.length < 2 && action == 'broadcast' && !bundleFlag) ) {
    console.log("\x1b[31m Invalid Syntax. Please call with following format: \x1b[0m\n");
    console.log("\x1b[32m    node manageTransactions.js display --b <bundle UUID>\x1b[0m\n");
    console.log("                       or\n");
    console.log("\x1b[32m    node manageTransactions.js broadcast --b <bundle UUID>\x1b[0m\n");
    console.log("                       or\n");
    console.log("\x1b[32m    node manageTransactions.js clear --b <bundle UUID>\x1b[0m\n");
    console.log("                       or\n");
    console.log("\x1b[32m    node manageTransactions.js clear 3,4,5 --b <bundle UUID>\x1b[0m\n");
    console.log("                       or\n");
    console.log("\x1b[32m    node manageTransactions.js <action> <filepath || tx || csv_list_of_txs>\x1b[0m");
    console.log("       Valid options for action are: \x1b[35m'confirm'\x1b[0m or \x1b[35m'revoke'\x1b[0m");
    console.log("       Add \x1b[32m--b <bundle UUID>\x1b[0m to work on a bundle cache without broadcasting\n");
    console.log(" Examples:")
    console.log("\x1b[32m    node manageTransactions.js confirm txs.to_confirm \x1b[0m");
    console.log("\x1b[32m    node manageTransactions.js confirm txs.to_confirm --b <bundle UUID>\x1b[0m");
    console.log("\x1b[32m    node manageTransactions.js confirm 5000 --b <bundle UUID>\x1b[0m");
    console.log("\x1b[32m    node manageTransactions.js revoke 2000,2001 \x1b[0m");
    console.log("\x1b[32m    node manageTransactions.js broadcast --b <bundle UUID>\x1b[0m");
    console.log("\n Optional:");
    console.log("   add \x1b[32m--ca <admin msig contract address>\x1b[0m to bypass ui prompt and force the admin msig to interact with");
    console.log("   add \x1b[32m--s \x1b[0m when calling broadcast to simulate the broadcast and display simulation results\n\n");
    process.exit(0);
  }

  if (contractAddress == undefined) {
    console.log('\nPlease Select Admin Multisig to interact with:\n');
    console.log('\x1b[33m1. 0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828 \x1b[0m (USDt,CNHt,MXNt,XAUt) \x1b[32m[Default]\x1b[0m\n');
    console.log('\x1b[33m2. 0x62b3a0f6ffc5efd7692053A9040fE44F9AC8c5Cb \x1b[0m (USAt)\n');
    const amq = await askQuestion('1 or 2 ? ');
    if (amq === '2') {
      contractAddress=getContractAddress('ADMIN_USAT');
    } else {
      contractAddress=getContractAddress('ADMIN');
    }
  }

  let bbText = bundleFlag? 'Enabled' : 'Disabled';
  let rText = rawFlag? 'Enabled' : 'Disabled';
  let simText = simFlag? 'Enabled' : 'Disabled';
  console.log('\n-------------------------------------------------');
  console.log(`Selected Admin Msig Address \x1b[33m${contractAddress}\x1b[0m`);
  console.log(`Bundle Operations \x1b[33m${bbText}\x1b[0m`);
  console.log(`SIMULATE Bundle Operations \x1b[33m${simText}\x1b[0m`);
  console.log(`Raw Output \x1b[33m${rText}\x1b[0m`);
  console.log('-------------------------------------------------\n');
  if (bundleFlag) {
    let bundleTxs = await getBundleCache(uuid);

    if (bundleTxs.length==0) {
      console.log('Please double check UUID, No Txs in Bundle')
      process.exit(0)
    }

    let signedtxarray = bundleTxs.reverse();
    let decodedPending = await decodeBundleTxs(signedtxarray);
    let bsigners={}

    console.log("\x1b[33mFound the following pending transactions in the Bundle Cache\n\x1b[0m");
    console.log("==================================\x1b[33m*PENDING\x1b[0m=====================================================================================");
    console.log("Index, TX*, Destination, Method, Address, Value, Sender, Nonce")
    let ptl = decodedPending.length;
    decodedPending.forEach(pTx => {
      console.log(`\x1b[33m${ptl},${pTx} \x1b[0m`);
      ptl--;
      let dt = pTx.split(',');
      let l = dt.length;
      let saddr = dt[l-2];
      let san = dt[l-1];
      if (bsigners[saddr] === undefined || bsigners[saddr].start > san) {
        bsigners[saddr] = {'start':san}
      }
    })
    console.log("===============================================================================================================================\n\n");
    console.log("\x1b[36mNote: the displayed Pending MultiSig TX Number* is calculated. If another multisig tx is submitted before this bundle, this will change.");
    console.log("To avoid confirmation issues in bundle, Please ensure this bundle is broadcasted before submitting new msig txs to the blockchain.\n\n\n\x1b[0m")

    bsigners = await populateNextNonce(bsigners);
    console.log("==================================\x1b[33mSigners Array\x1b[0m================================================================================");
    console.log("\tSigning Address \t\t\tFirst Offline Tx Nonce \tNext Blockchain Nonce \t\tStatus");
    for (const [addr, data] of Object.entries(bsigners)) {
      let s_status='\x1b[32m\tPassed\x1b[0m';
      if (parseInt(data.start) !== parseInt(data.next)) {
        s_status='\x1b[31mError: Nonce MisMatch\x1b[0m'
      }
      console.log(`\x1b[33m${addr},\t\t${data.start},\t\t\t${data.next},\t\t\x1b[0m${s_status}`);
    }
    console.log("===============================================================================================================================\n\n");

    if (action == 'display') {
      return process.exit(0);
    }

    if (action == 'broadcast') {
      const bq = await askQuestion('\nBroadcast Bundle Txs to Blockchain? [y/n] ');
      if (bq === 'y') {
        await bundleRebroadcast(signedtxarray,simFlag);
        await new Promise(resolve => setTimeout(resolve, 2000));
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

  console.log('Config:')
  console.log(config)

  let filePath = myArgs[1];
  if (fs.existsSync(filePath)) {
    txs = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  } else {
    txs = myArgs[1].split(',').filter(Boolean);
  }

  let sortedTxs={};
  let data;
  if (txs.length==1) {
    data=[txs,txs]
  } else {
    data=[txs.join(",")]
  }

  //bundles won't have any data in processList
  if (!bundleFlag) {
    console.log('txs:')
    await processList(data,contractAddress,true).then(res => {
      res.forEach(subArray => {
        if (subArray.length > 0) {
          const key = subArray[0]; // First element as key
          const value = subArray.slice(1); // Remaining elements as value
          sortedTxs[key] = value; // If only one value, store it as a single value
        }
      });
    });
  }

  console.log(`\nYou are performing ---------- \x1b[35m${action}\x1b[0m ---------- on the above list of transactions.\n`);
  console.log('Please review the configuration and Transaction list\n');
  const answer = await askQuestion(`\nProceed? [y/n]: `);
  if (answer !== 'y') {
    console.log('Exiting')
    return process.exit(1)
  }

  console.log('Initializing....')

  try {
    const ledger = await createLedger();
    const signer = await ledger.getAddress(config.hd_path);
    let nonce = await web3.eth.getTransactionCount(signer.address);
    console.log("Signing Address:", signer.address)
    console.log("Using NONCE from blockchain: \x1b[32m%s\x1b[0m",nonce)

    try {
      for (const tx of txs) {
        if (!tx.startsWith('#')) {
          let txDetails = sortedTxs[tx];
          let executed=false;
          let signers=[];
          if (txDetails) {
            executed = txDetails[4];
            signers = txDetails[6];
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

            let baseGas = 2;
            //if (bundleFlag) {
            //  baseGas = 4;
            //}
            ({ gasPrice, maxFeePerGas } = await updateGas(baseGas));
            await sign(ledger, tx, nonce, action, bundleFlag, rawFlag);
            nonce++;

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

    if (!bundleFlag && !rawFlag) {
      await getStatus(txHashes);
      console.log("Checking TX Status");
      await new Promise(resolve => setTimeout(resolve, 2000));
      await processList(data,contractAddress,true);
    }
    process.exit(0)
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}

main();
