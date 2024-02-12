'use strict'

const config = require('./ethConfig.json')
const myArgs = process.argv.slice(2)

const Web3 = require('web3').Web3
const web3 = new Web3(new Web3.providers.HttpProvider(config.web3url))

const hex = myArgs[0]

async function broadcast(signedtx) {
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
      console.log("Broadcast Failed: \x1b[32m%s\x1b[0m",err.message)
    }
}


broadcast(hex)
