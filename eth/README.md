Batch utility to send multiple eth confirmations using Ledger. 

Follow install instructions from main readme

cp examples/ethConfig.json.example ethConfig.json

Update ethConfig.json and fill in/update: 
web3url: your specific infura url (can signup for free on infura.io) used for broadcasting
contract_address: used only for confirm tx right now
filePath: default file to read the instructions from, can also be passed as first argument when calling scripts

startingNonce and gasprice are pulled from blockchain
signingAddress is pulled from ledger


Usage: 
`node confirmTransactions.js <file>`
`node revokeTransactions.js <file>`
`node submitTransactions.js <file>`

<file> takes the format of 
For confirm/revoke: list of txs numbers (one per line) to confirm/revoke. Example: 
1
2
3

For submit: list of actions to take in the following format
<currency> <action> <...params>

Example: 
#freeze address 0x11111
USDT freeze 0x11111
#unfreeze address 0x11111
USDT unfreeze 0x11111
#issue 1 Billion (defaults to msig contract)
USDT issue 1000000000000000
#transfer 1 Billion from msig contract to 0x5754284f345afc66a98fbb0a0afe71e0f007b949
USDT transfer 0x5754284f345afc66a98fbb0a0afe71e0f007b949 1000000000000000


Program will cycle through the <file> line by line and create/prompt user to review and broadcast the confirm transaction id. 
