const {
  adminMSIG,
  decodeData,
} = require('./common');

let detailFlag, printSummary, printGroup;

const interval = 300
const range = (start, stop, step) =>
  Array.from({ length: (stop - start) / step + 1 }, (_, i) => start + i * step);

let grouped = {};
let txList = [];
var respData = [];
var callsRemaining = 0;

async function getStatusHelper(tx) {
  try {
    const result = await adminMSIG.methods.transactions(tx).call();
    let formatted_amount, method, addr;

    if (result.data == null) {
      formatted_amount = result.value / 1e18;
      method = 'eth-transfer';
      addr = result.destination;
    } else {
      const data = decodeData(result.data);
      formatted_amount = data.value;
      method = data.method;
      addr = data.addr;
    }

    const ret = [
      tx,
      result.destination,
      method,
      addr,
      formatted_amount,
      result.executed
    ];

    if (result.executed || !detailFlag) {
      checkPrint(ret);
    } else {
      await getConfirmationsHelper(tx, ret);
    }
  } catch (error) {
    checkPrint([tx, 'error', error.message || error]);
  }
}

function checkPrint(ret) {
  respData.push(ret);
  --callsRemaining;
  if (callsRemaining <= 0) {
    sorted=respData.sort((a,b) => a[0] - b[0] )

    if (printSummary) {
      console.log(['TX', 'Destination', 'Method', 'Address', 'Value', 'Executed'].join(','));
    }

    sorted.forEach(ele => {
      method=ele[2]
      if (grouped[method] === undefined) {
        grouped[method] = []
      }
      grouped[method].push(ele)

      if (printSummary) {
        if (ele[5]) {
          console.log('\x1b[32m%s\x1b[0m',ele.join(','));
        } else {
          console.log('\x1b[33m%s\x1b[0m',ele.join(','));
        }
      }
    })

    if (printGroup) {
      Object.entries(grouped).forEach(([key, value]) => {
        console.log(`\nMethod: \x1b[35m${key}\x1b[0m, \x1b[33m${value.length}\x1b[0m transactions`);
        console.log(['TX', 'Destination', 'Method', 'Address', 'Value', 'Executed'].join(','));
        value.forEach(ele => {
          if (ele[5]) {
            console.log('\x1b[32m%s\x1b[0m',ele.join(','));
          } else {
            console.log('\x1b[33m%s\x1b[0m',ele.join(','));
          }
        });
      });
    }
  }
}

async function getConfirmationsHelper(tx,ret) {
  await adminMSIG.methods.getConfirmations(tx).call().then( result=> {
    rl = result.length
    ret = ret.concat(rl+" - "+result)
    //console.log(ret.join(","));
    //console.log('\x1b[33m%s\x1b[0m',ret.join(','));
    checkPrint(ret)
  }).catch( error=> {
    //console.log([tx,'error',error].join(","))
    checkPrint([tx,'error',error])
  })
}

async function getStatus() {
  console.log("Processing", txList.length, "items");

  return new Promise((resolve) => {
    if (txList.length === 0) {
      return resolve();
    }

    async function processNext() {
      if (txList.length === 0) {
        return resolve();
      }

      let tx = txList.shift();
      await getStatusHelper(tx);

      setTimeout(processNext, interval); // Schedule the next execution
    }

    processNext(); // Start processing
  });
}

async function processList(list, df, ps, pg) {
  detailFlag = (df === undefined) ? false : df;
  printSummary = (ps === undefined) ? false : ps;
  printGroup = (pg === undefined) ? true : pg;

  //make sure list is reset before processing again;
  respData.length=0

  await adminMSIG.methods.transactionCount().call().then( txCount =>{
    end = parseInt(txCount) - 1
    switch (list.length) {
      case 1:
        sData=list[0].toString()
        if (sData.includes(",")) {
          itemList = sData.split(",")
          itemList.forEach((item) => {
            item=parseInt(item)
            if (item <= end) {
              txList.push(item)
            }
          });
        }
        else {
          start = parseInt(sData);
          txList = range(start,end,1)
        }
        break;
      case 2:
        start = parseInt(list[0]);
        finish = parseInt(list[1]);
        if (finish < end) {
          end = finish;
        }
        txList = range(start,end,1);
        break;
      default:
        console.log("Usage: node queryManagementTxStatusInfo.js <start> <end optional>");
        console.log("Current tx count, ",parseInt(txCount));
        console.log(list);
        return;
    }
  })
  callsRemaining=txList.length
  await getStatus();
  let sorted=respData.sort((a,b) => a[0] - b[0] )
  Object.keys(grouped).forEach(key => delete grouped[key]);
  return sorted;
}

module.exports = {
  processList
}
