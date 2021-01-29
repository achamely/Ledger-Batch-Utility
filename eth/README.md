Batch utility to send multiple eth confirmations using Ledger. 

Follow install instructions from main readme

cp ethConfig.json.example ethConfig.json

Update ethConfig.json and fill in infura url (used for broadcasting)

Update ethConfig.json and fill in signing address

Update ethConfig.json and fill in contract address (used only for confirm tx right now)

Update ethConfig.json and specify the file to read the tx list from or pass filename as first argument 

startingNonce and gasprice are pulled from blockchain


Usage: 
`node confirm.js <optional starting nonce>`

Program will cycle through the Ledger-Eth-1 file line by line and create /prompt user to review and broadcast the confirm transaction id. 
