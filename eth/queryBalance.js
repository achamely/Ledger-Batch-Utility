'use strict';

const {
  getTotal,
  processList,
} = require('./helperQueryBalance');

const { fs } = require('./common');

async function main() {
  const interval = 450;
  const myArgs = process.argv.slice(2);

  let results = {};
  let filePath;

  if (myArgs.length > 0) {
    filePath = myArgs[0];
  } else {
    console.log("node queryBalance.js address-file <token>");
    process.exit(1);
  }

  let token = 'USDT';
  if (myArgs.length > 1) {
    token = myArgs[1].toUpperCase()
  }

  if (!['USDT','EURT','CNHT','MXNT','XAUT'].includes(token)) {
    console.log('\x1b[31m Unknown Token:\x1b[35m',token,'\x1b[0m');
    console.log('\x1b[33m Available Token options:\x1b[36m  "USDT" (Default), "EURT", "CNHT", "MXNT", "XAUT"\x1b[0m');
    console.log('\x1b[32m node queryBalance.js address-file <token>\x1b[0m');
    process.exit(1)
  }

  let addressList;
  let writeFile=true;
  try {
    addressList = fs.readFileSync(filePath).toString().split('\n').filter(Boolean);
  } catch (e) {
    addressList = [filePath];
    writeFile=false;
  }

  let lr;
  if (addressList[0].substring(0, 9) == 'Last Run,') {
    lr = addressList.shift().split(',')[1];
  } else {
    lr = 'Unknown';
  }


  await processList(token, addressList, interval, results);

  let ts = (new Date().toUTCString()).replace(',','')

  let ws;
  if (writeFile) {
    ws = fs.createWriteStream(filePath);
    ws.write('Last Run,' + ts + '\n');
  }

  console.log('\n\n------------------------------');
  console.log(`  Balances for Token: ${token}`);
  console.log('------------------------------\n');


  console.log('\x1b[32m Current Run\x1b[0m,\x1b[34m\x1b[47m%s\x1b[0m', ts);
  console.log('\x1b[32m    Last Run\x1b[0m,\x1b[34m\x1b[47m%s\x1b[0m', lr);

  let gb = 0;
  for (const [key, value] of Object.entries(results)) {
    let addr = key;
    let data = value;
    let obal = parseInt(data['obalance']) || 0;
    let note = data['note'] || '';
    let freeze = data['blacklist'] ? 'Frozen' : 'clear';
    let bal = parseInt(data['balance']) / 1e6;
    let bdif = 0;

    if (note[0] != "#") {
      gb += parseInt(data['balance']);
    }

    if (obal !== undefined && obal !== NaN && obal !== bal) {
      bdif = bal - obal;
      console.log('%s,\x1b[32m%s\x1b[0m,\x1b[31m%s\x1b[0m,\x1b[36m%s\x1b[0m -- CHANGED -- Previous Balance:\x1b[32m%s\x1b[0m -- Difference:\x1b[32m%s\x1b[0m', freeze, addr, bal, note, obal, bdif);
    } else {
      console.log('%s,\x1b[32m%s\x1b[0m,\x1b[33m%s\x1b[0m,\x1b[36m%s\x1b[0m', freeze, addr, bal, note);
    }
    if (writeFile) {
      ws.write([addr, bal, note].join(",") + '\n');
    }
  }

  console.log('\x1b[36mtotal_addr\x1b[0m,\x1b[33m%s\x1b[0m', gb / 1e6);
  await getTotal(token);
  process.exit(0);
}

main();
