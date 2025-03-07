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
const config = require('./tronConfig.json');
let txs;

const sign = async function (ledger, tx, action) {
  // construct the data packet for confirming a tx
  var txo = await getTxData(action,tx)
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

  await broadcast(txo.transaction);
}


async function main() {
  const myArgs = process.argv.slice(2)
  let action = myArgs[0].toLowerCase();
  if ( !['confirm','revoke'].includes(action) || myArgs.length < 2) {
    console.log("\x1b[31m Invalid Syntax. Please call with following format: \x1b[0m");
    console.log("\x1b[32m    node manageTransactions.js <action> <filepath || tx || csv_list_of_txs>\x1b[0m");
    console.log(" Valid options for action are \x1b[35m'confirm'\x1b[0m or \x1b[35m'revoke'\x1b[0m");
    console.log(" Examples:")
    console.log("\x1b[32m    node manageTransactions.js confirm txs.to_confirm \x1b[0m");
    console.log(" or")
    console.log("\x1b[32m    node manageTransactions.js revoke 2000,2001 \x1b[0m");
    process.exit(0);
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

  rl.question(`\nYou are performing ---------- \x1b[35m${action}\x1b[0m ---------- on the above list of transactions.\nIs the configuration correct? [y/n]: `, async function (answer) {
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
              await sign(ledger, tx, action);
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
  })

}

main()
