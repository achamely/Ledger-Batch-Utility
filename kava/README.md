Batch utility to send multiple confirmations using Ledger. 

Follow install instructions from main readme:
 - `cp examples/ethConfig.json.example ethConfig.json`

Update ethConfig.json and fill in/update:
 - `web3url`: your specific infura url (can signup for free on infura.io) used for broadcasting
 - `contract_address`: used only for confirm tx right now
 - `filePath`: default file to read the instructions from, can also be passed as first argument when calling scripts

`startingNonce` and `gasprice` are pulled from blockchain

`signingAddress` is pulled from ledger

Usage: 
```
node confirmTransactions.js <file>
node revokeTransactions.js <file>
node submitTransactions.js <file>
```

Example subfolder contains sample files

Program will cycle through the <file> line by line and create/prompt user to review and broadcast the confirm transaction id. 
