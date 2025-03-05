const request = require('request-promise')

const interval=2000;
let results={}

async function updateResults(txhash) {
  let txstatus = await request.get({
        url: 'https://protect.flashbots.net/tx/'+txhash,
        json: true
      })
  let status = txstatus.status
  let maxBlock = txstatus.maxBlockNumber
  results[txhash]={'status':status, 'maxBlockNumber':maxBlock}
}

async function getStatus(txlist) {
 return new Promise(function(resolve,reject){
  idx = setInterval(async function() {
    for (let x in txlist) {
      txid=txlist[x]
      if (txid in results && ['INCLUDED','FAILED','CANCELLED','UNKNOWN'].includes(results[txid]['status'])) {
        txlist.splice(txlist.indexOf(txid),1)
      } else {
      await updateResults(txid)
      }
    }
    if (txlist.length < 1) {
      return resolve(clearInterval(idx));
    }
    //console.log('\033[2J');
    console.clear();
    console.log(results);
  }, interval);
 });
}

module.exports = {getStatus}
