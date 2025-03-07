Batch utility to send multiple eth confirmations using Ledger. 

Follow install instructions from main readme:
 - `cp examples/ethConfig.json.example ethConfig.json`

Update ethConfig.json and fill in/update:
 - `web3url`: your specific infura url (can signup for free on infura.io) used for broadcasting
 - `contract_address`: used only for confirm tx right now

`startingNonce` and `gasprice` are pulled from blockchain

`signingAddress` is pulled from ledger

Usage: 
```
node manageTransactions.js confirm <file>
node manageTransactions.js confirm <msig_id>
node manageTransactions.js confirm <msig_id>,<msig_id>,<msig_id>
node manageTransactions.js revoke <file>
node manageTransactions.js revoke <msig_id>
node manageTransactions.js revoke <msig_id>,<msig_id>,<msig_id>
node submitTransactions.js <file>
node submitTransactions.js usdt freeze <address>
node queryManagementTxStatusInfo.js <msig_id>
```

Example subfolder contains sample files

Program will cycle through the <file> line by line and create/prompt user to review and broadcast the confirm transaction id. 
