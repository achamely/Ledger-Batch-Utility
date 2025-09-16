const {
  tetherUSDT,
  tetherEURT,
  tetherCNHT,
  tetherMXNT,
  tetherXAUT,
  fs,
} = require('./common');

const MAX_RETRIES = 4;
const RETRY_DELAY = 1000; // Initial delay in milliseconds

async function retryPromise(fn, retries = MAX_RETRIES, delay = RETRY_DELAY) {
  try {
    return await fn();
  } catch (err) {
    if (retries > 0) {
      console.log(`Error: Retrying in ${delay / 1000}s... (${retries} retries left)`);
      await delayPromise(delay);
      return retryPromise(fn, retries - 1, delay * 2); // Exponential backoff
    } else {
      console.log("Max retries reached. Aborting...");
      throw err;
    }
  }
}

function delayPromise(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getContract(token) {
  let contract;
  switch (token.toUpperCase()) {
    case 'MXNT':
      contract = tetherMXNT;
      break
    case 'CNHT':
      contract = tetherCNHT;
      break
    case 'EURT':
      contract = tetherEURT;
      break
    case 'XAUT':
      contract = tetherXAUT;
      break
    case 'USDT':
    default:
      contract = tetherUSDT;
  }
  return contract;
}

async function getBalance(token, addr) {
  const contract = getContract(token);
  const updateBalanceFn = async () => {
    const result = await contract.methods.balanceOf(addr).call();
    if (Number.isNaN(result)) {
      throw new Error("Balance Call Failed")
    }
    return result;
  };

  return await retryPromise(updateBalanceFn);
}

async function getBlackListStatus(token, addr) {
  const contract = getContract(token);
  const updateBlackFn = async () => {
    let result;
    if ('isBlocked' in contract.methods) {
      result = await contract.methods.isBlocked(addr).call();
    } else {
      result = await contract.methods.isBlackListed(addr).call();
    }
    if (Number.isNaN(result)) {
      throw new Error("getBlackListStatus Call Failed")
    }
    return result;
  };

  return await retryPromise(updateBlackFn);
}

async function updateItem(token, item, results) {
  if (!item) {
    console.log("Skipping invalid item:", item);
    return;
  }

  let data = item.split(",");
  let addr = data[0];
  let ob = data[1] || 0;
  let note = data[2] || '';
  results[addr] = { 'obalance': ob, 'note': note };

  results[addr]['balance'] = await getBalance(token, addr);
  results[addr]['blacklist'] = await getBlackListStatus(token, addr);

}

async function processList(token, addressList, interval, results) {
  return new Promise((resolve) => {
    let idx = setInterval(async function() {
      let item = addressList.shift();
      await updateItem(token, item, results);
      if (addressList.length < 1) {
        resolve(clearInterval(idx));
      }
    }, interval);
  });
}

async function getTotal(token) {
  try {
    const contract = getContract(token);
    const result = await contract.methods.totalSupply().call();
    let bal = parseInt(result) / 1e6;
    let tokenAddr = contract._address
    let tokenSym = await contract.methods.symbol().call();
    const ts = fs.createWriteStream('total.balance.'+tokenSym+'.'+tokenAddr, { 'flags': 'a' });

    console.log('\x1b[35mtotal_token\x1b[0m,\x1b[33m%s\x1b[0m', bal);
    ts.write(new Date().toUTCString() + " : " + bal + '\n');
    await delayPromise(400)
  } catch (error) {
    console.log('Error fetching total balance:', error);
  }
}

module.exports = {
  getBalance,
  getBlackListStatus,
  processList,
  getTotal
};
