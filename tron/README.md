Batch utility to send multiple tron confirmations using Ledger. 

Follow install instructions from main readme:
 - `cp examples/tronConfig.json.example tronConfig.json`

Update tronConfig.json as needed:
 - `fullHostUrl`: url to use for blockchain details, default `"https://api.trongrid.io"`
 - `trongridApiKey`: (optional) provide an api key to access trongrid resources with relaxed api rate limits
 - `feeLimit`: max fee tx should be allowed, default `1000000000`
 - `contract_address`: msig contract instructions should be sent to, default: `"TBPxhVAsuzoFnKyXtc1o2UySEydPHgATto"`
 - `filePath`: default file to read the instructions from, can also be passed as first argument when calling scripts
 - `hd_path`: ledger address derivation path, default: `"44'/195'/0'/0/0"`
 - `signerAddress`: signing address of your ledger, used during tx validation


Usage: 
```
node confirmTransactions.js <file>
node revokeTransactions.js <file>
node submitTransactions.js <file>
```

Example subfolder contains sample files

Program will cycle through the <file> line by line and create/prompt user to review and broadcast the confirm transaction id. 
