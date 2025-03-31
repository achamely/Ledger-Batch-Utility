const request = require('request-promise')

const interval=2000;
let results={}

async function updateResults(txhash) {
  try {
    let response = await request.get({
        url: 'https://protect.flashbots.net/tx/'+txhash,
        json: true,
        resolveWithFullResponse: true
      })
    if (response.statusCode == 200) {
      let txstatus = response.body;
      let status = txstatus.status;
      let maxBlock = txstatus.maxBlockNumber;
      results[txhash]={'status':status, 'maxBlockNumber':maxBlock};
    }
  } catch (err) {
    console.log(`Error getting ${txhash} status, retrying... ${err}`);
  }
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
