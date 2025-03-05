const {
  processList,
} = require('./helperQueryManagement');

const myArgs = process.argv.slice(2)


async function main() {

 let detailFlag,printSummary,printGroup;
 let txArgs=[]

 for (let i = 0; i < myArgs.length; i++) {
  const arg = myArgs[i];
  if (arg.toString().startsWith('--')) {
    const key = arg.slice(2);
    const val = [1,''].includes(key.slice(1));
    if (key[0].toLowerCase()=='d') {
      detailFlag=val
    }
    if (key[0].toLowerCase()=='s') {
      printSummary=val;
    }
    if (key[0].toLowerCase()=='g') {
      printGroup=val;
    }
  } else {
    txArgs.push(arg);
  }
 }

  await processList(txArgs,detailFlag,printSummary,printGroup)
  process.exit(0);
}

main();
