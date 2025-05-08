'use strict';

const {
  createLedger,
  padLeftZeros,
  getTxData,
  updateGas,
  broadcast,
  web3,
  common,
  FeeMarketEIP1559Transaction,
  bytesToHex,
  ledgerService,
  rl,
  adminMSIG,
  txHashes,
  fs,
} = require('./common');

const { processList } = require('./helperQueryManagement');

const config = require('./ethConfig.json');

const contractAddress = config.contract_address;
const gasLimit = config.gasLimit;
let gasPrice, maxFeePerGas;
let txs;

const sign = async (ledger, tx, nonce, action) => {
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

  await broadcast(signedHex);
};

async function main() {
  const myArgs = process.argv.slice(2);
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

              ({ gasPrice, maxFeePerGas } = await updateGas());
              await sign(ledger, tx, nonce, action);
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
      console.log("Checking TX Status");
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('Finished')
      await processList(data,true);
      process.exit(0)
    } catch (err) {
      console.log(err)
      process.exit(1)
    }
  })
}

main();
