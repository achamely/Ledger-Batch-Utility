Batch utility to send multiple tron confirmations using Ledger. 

Follow install instructions from main readme:
 - `cp examples/tronConfig.json.example tronConfig.json`

Update tronConfig.json as needed:
 - `fullHostUrl`: url to use for blockchain details, default `"https://api.trongrid.io"`
 - `trongridApiKey`: (optional) provide an api key to access trongrid resources with relaxed api rate limits
 - `feeLimit`: max fee tx should be allowed, default `1000000000`
 - `contract_address`: msig contract instructions should be sent to, default: `"TBPxhVAsuzoFnKyXtc1o2UySEydPHgATto"`
 - `hd_path`: ledger address derivation path, default: `"44'/195'/0'/0/0"`
 - `signerAddress`: signing address of your ledger, used during tx validation


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
