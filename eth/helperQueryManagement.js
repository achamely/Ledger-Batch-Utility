const {
  adminMSIG,
  decodeData,
} = require('./common');

const config = require('./ethConfig.json')

let detailFlag, printSummary, printGroup;

const interval = 300
const range = (start, stop, step) =>
  Array.from({ length: (stop - start) / step + 1 }, (_, i) => start + i * step);

let grouped = {};
let txList = [];
var respData = [];
var callsRemaining = 0;

async function getStatusHelper(tx) {
  adminMSIG.methods.transactions(tx).call().then( result=> {
    //console.log(result);
    if (result.data == null) {
      formatted_amount = result.value/1e18
      method = 'eth-transfer'
      addr = result.destination
    } else {
      data = decodeData(result.data)
      //console.log("TX:",tx,"-",result.destination,'-',data.method,data.addr,data.value,'- Executed:',result.executed);
      //formatted_amount = data.value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
      formatted_amount = data.value
      method = data.method
      addr = data.addr
    }
    ret = [tx,result.destination,method,addr,formatted_amount,result.executed]
    if (result.executed || !detailFlag) {
      //console.log('\x1b[32m%s\x1b[0m',ret.join(','));
      checkPrint(ret);
    } else {
      //console.log('\x1b[33m%s\x1b[0m',ret.join(','));
      getConfirmationsHelper(tx,ret)
    }
  }).catch( error=> {
    //console.log([tx,'error',error].join(","))
    checkPrint([tx,'error',error])
  })
}

function checkPrint(ret) {
  respData.push(ret);
  --callsRemaining;
  if (callsRemaining <= 0) {
    sorted=respData.sort((a,b) => a[0] - b[0] )

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
        console.log(`Method: \x1b[35m${key}\x1b[0m, \x1b[33m${value.length}\x1b[0m transactions`);
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
  adminMSIG.methods.getConfirmations(tx).call().then( result=> {
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
  console.log(['TX', 'Destination', 'Method', 'Address', 'Value', 'Executed'].join(','));

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

async function getStatus_interval() {
  console.log("processing ",txList.length," items");
  console.log(['TX','Destination','Method','Address','Value','Executed'].join(','));

  return new Promise((resolve, reject) => {
    if (txList.length === 0) {
      //console.log("No transactions to process.");
      return resolve();
    }


    let idx = setInterval(async function () {
      if (txList.length === 0) {
        clearInterval(idx);  // Ensure interval is cleared
        //console.log("All transactions checked.");
        resolve();  // Resolve the Promise
      } else {
        let tx = txList.shift();
        await getStatusHelper(tx);
      }
    }, interval);
  });
}

async function processList(list, df, ps, pg) {
  detailFlag = (df === undefined) ? false : df;
  printSummary = (ps === undefined) ? false : ps;
  printGroup = (pg === undefined) ? true : pg;

  await adminMSIG.methods.transactionCount().call().then( txCount =>{
    end = parseInt(txCount) - 1
    switch (list.length) {
      case 1:
        if (list[0].includes(",")) {
          itemList = list[0].split(",")
          itemList.forEach((item) => {
            item=parseInt(item)
            if (item <= end) {
              txList.push(item)
            }
          });
        }
        else {
          start = parseInt(list[0]);
          txList = range(start,end,1)
        }
        break;
      case 2:
        start = parseInt(list[0]);
        finish = parseInt(list[1]);
        if (finish < end) {
          end = finish;
        }
        txList = range(start,end,1)
        break;
      default:
        console.log("Usage: node queryManagementTxStatusInfo.js <start> <end optional>");
        console.log("Current tx count, ",txCount);
    }
  })
  callsRemaining=txList.length
  await getStatus();
}

module.exports = {
  processList
}
