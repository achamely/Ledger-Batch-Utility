'use strict';

const {
  createLedger,
  padLeftZeros,
  getTxData,
  updateGas,
  broadcastFlashbot,
  web3,
  common,
  FeeMarketEIP1559Transaction,
  bytesToHex,
  ledgerService,
  rl,
  adminMSIG,
  txHashes,
} = require('./common');

const { getStatus } = require('./flashbotStatus.js')
const { processList } = require('./helperQueryManagement');

const config = require('./ethConfig.json');
const fs = require('fs');
const myArgs = process.argv.slice(2);

let filePath = myArgs.length > 0 ? myArgs[0] : config.filePath;
const txs = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
const contractAddress = config.contract_address;
const gasLimit = config.gasLimit;
let gasPrice, maxFeePerGas;

const sign = async (ledger, tx, nonce) => {
  const data = '0xc01a8c84' + padLeftZeros(parseInt(tx).toString(16));
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

  await broadcastFlashbot(signedHex);
};

async function main() {
  console.log('Config:')
  console.log(config)
  console.log('txs:')
  //console.log(txs)
  await processList([txs.join(",")],true);

  rl.question('\nIs the configuration correct? [y/n]: ', async function (answer) {
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
            ({ gasPrice, maxFeePerGas } = await updateGas());
            await sign(ledger, tx, nonce);
            nonce++;
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
      console.log("Checking TX Status");
      await new Promise(resolve => setTimeout(resolve, 2000));
      await processList([txs.join(",")],true);

      process.exit(1)
    } catch (err) {
      console.log(err)
      process.exit(1)
    }
  })
}

main();
