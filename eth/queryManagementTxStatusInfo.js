const {
  processList,
} = require('./helperQueryManagement');

const {
  askQuestion,
  getContractAddress,
} = require('./common');

async function main() {
  const myArgs = process.argv.slice(2)

  let contractAddress;
  let detailFlag,printSummary,printGroup;
  let txArgs=[]

  for (let i = 0; i < myArgs.length; i++) {
    const arg = myArgs[i];
    if (arg.toString().startsWith('--')) {
      const key = arg.slice(2).toLowerCase();
      myArgs.splice(i,1);
      val = myArgs[i];
      myArgs.splice(i,1);
      if (key[0].toLowerCase()=='d') {
        detailFlag=[1,''].includes(val);
      }
      if (key[0].toLowerCase()=='s') {
        printSummary=[1,''].includes(val);
      }
      if (key[0].toLowerCase()=='g') {
        printGroup=[1,''].includes(val);
      }
      if (['c','ca'].includes(key)) {
        contractAddress = val.toLowerCase();
      }
    } else {
      txArgs.push(arg);
    }
  }

  if (contractAddress == undefined) {
    console.log('\nPlease Select Admin Multisig to interact with:\n');
    console.log('\x1b[33m1. 0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828 \x1b[0m (USDt,CNHt,MXNt,XAUt) \x1b[32m[Default]\x1b[0m\n');
    console.log('\x1b[33m2. 0x62b3a0f6ffc5efd7692053A9040fE44F9AC8c5Cb \x1b[0m (USAt)\n');
    const amq = await askQuestion('1 or 2 ? ');
    if (amq === '2') {
      contractAddress=getContractAddress('ADMIN_USAT');
    } else {
      contractAddress=getContractAddress('ADMIN');
    }
  }


  await processList(txArgs,contractAddress,detailFlag,printSummary,printGroup)
  process.exit(0);
}

main();
