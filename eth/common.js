'use strict'

const FeeMarketEIP1559Transaction = require('@ethereumjs/tx').FeeMarketEIP1559Transaction;
const bytesToHex = require('@ethereumjs/util').bytesToHex;
const AppEth = require('@ledgerhq/hw-app-eth').default;
const Chain = require('@ethereumjs/common').Chain;
const Hardfork = require('@ethereumjs/common').Hardfork;
const Common = require('@ethereumjs/common').Common;
const Web3 = require('web3').Web3;
const Transport = require('@ledgerhq/hw-transport-node-hid').default;
const request = require('request-promise');
const ledgerService = require('@ledgerhq/hw-app-eth').ledgerService;
const { createInterface } = require('readline');
const fs = require('fs');

const Wallet = require('ethers').Wallet;
const id = require('ethers').id;
const Transaction = require('ethers').Transaction;

const config = require('./ethConfig.json');
const web3 = new Web3(new Web3.providers.HttpProvider(config.web3url));
const chainId = Chain.Mainnet;
const common = new Common({ chain: chainId, hardfork: Hardfork.London, eips: [1559] });

const rl = createInterface(process.stdin, process.stdout);
const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

const adminMSIG  = getContract('ADMIN');
const tetherUSDT = getContract('USDT');
const tetherEURT = getContract('EURT');
const tetherCNHT = getContract('CNHT');
const tetherMXNT = getContract('MXNT');
const tetherXAUT = getContract('XAUT');

function contractAbiList(address) {
  let abi;
  switch (address.toLowerCase()) {
    case '0xc6cde7c39eb2f0f0095f41570af89efc2c1ea828':
      abi = [{"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"owners","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"owner","type":"address"}],"name":"removeOwner","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"transactionId","type":"uint256"}],"name":"revokeConfirmation","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"isOwner","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"uint256"},{"name":"","type":"address"}],"name":"confirmations","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"pending","type":"bool"},{"name":"executed","type":"bool"}],"name":"getTransactionCount","outputs":[{"name":"count","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"owner","type":"address"}],"name":"addOwner","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"transactionId","type":"uint256"}],"name":"isConfirmed","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"transactionId","type":"uint256"}],"name":"getConfirmationCount","outputs":[{"name":"count","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"transactions","outputs":[{"name":"destination","type":"address"},{"name":"value","type":"uint256"},{"name":"data","type":"bytes"},{"name":"executed","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getOwners","outputs":[{"name":"","type":"address[]"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"from","type":"uint256"},{"name":"to","type":"uint256"},{"name":"pending","type":"bool"},{"name":"executed","type":"bool"}],"name":"getTransactionIds","outputs":[{"name":"_transactionIds","type":"uint256[]"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"transactionId","type":"uint256"}],"name":"getConfirmations","outputs":[{"name":"_confirmations","type":"address[]"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"transactionCount","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_required","type":"uint256"}],"name":"changeRequirement","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"transactionId","type":"uint256"}],"name":"confirmTransaction","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"destination","type":"address"},{"name":"value","type":"uint256"},{"name":"data","type":"bytes"}],"name":"submitTransaction","outputs":[{"name":"transactionId","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"MAX_OWNER_COUNT","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"required","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"owner","type":"address"},{"name":"newOwner","type":"address"}],"name":"replaceOwner","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"transactionId","type":"uint256"}],"name":"executeTransaction","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[{"name":"_owners","type":"address[]"},{"name":"_required","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"sender","type":"address"},{"indexed":true,"name":"transactionId","type":"uint256"}],"name":"Confirmation","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"sender","type":"address"},{"indexed":true,"name":"transactionId","type":"uint256"}],"name":"Revocation","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"transactionId","type":"uint256"}],"name":"Submission","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"transactionId","type":"uint256"}],"name":"Execution","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"transactionId","type":"uint256"}],"name":"ExecutionFailure","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"sender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Deposit","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"}],"name":"OwnerAddition","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"}],"name":"OwnerRemoval","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"required","type":"uint256"}],"name":"RequirementChange","type":"event"}];
      break
    case '0xdac17f958d2ee523a2206206994597c13d831ec7':
      abi = [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_upgradedAddress","type":"address"}],"name":"deprecate","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"deprecated","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_evilUser","type":"address"}],"name":"addBlackList","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"upgradedAddress","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"balances","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"maximumFee","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"_totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"unpause","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_maker","type":"address"}],"name":"getBlackListStatus","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"},{"name":"","type":"address"}],"name":"allowed","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"paused","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"who","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"pause","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getOwner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"newBasisPoints","type":"uint256"},{"name":"newMaxFee","type":"uint256"}],"name":"setParams","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"issue","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"redeem","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"remaining","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"basisPointsRate","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"isBlackListed","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_clearedUser","type":"address"}],"name":"removeBlackList","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"MAX_UINT","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_blackListedUser","type":"address"}],"name":"destroyBlackFunds","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[{"name":"_initialSupply","type":"uint256"},{"name":"_name","type":"string"},{"name":"_symbol","type":"string"},{"name":"_decimals","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"name":"amount","type":"uint256"}],"name":"Issue","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"amount","type":"uint256"}],"name":"Redeem","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"newAddress","type":"address"}],"name":"Deprecate","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"feeBasisPoints","type":"uint256"},{"indexed":false,"name":"maxFee","type":"uint256"}],"name":"Params","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_blackListedUser","type":"address"},{"indexed":false,"name":"_balance","type":"uint256"}],"name":"DestroyedBlackFunds","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_user","type":"address"}],"name":"AddedBlackList","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_user","type":"address"}],"name":"RemovedBlackList","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[],"name":"Pause","type":"event"},{"anonymous":false,"inputs":[],"name":"Unpause","type":"event"}];
      break
    case '0xc581b735a1688071a1746c968e0798d642ede491':
      abi = [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_user","type":"address"}],"name":"BlockPlaced","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_user","type":"address"}],"name":"BlockReleased","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_blockedUser","type":"address"},{"indexed":false,"internalType":"uint256","name":"_balance","type":"uint256"}],"name":"DestroyedBlockedFunds","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_destination","type":"address"},{"indexed":false,"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"Mint","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_contract","type":"address"}],"name":"NewPrivilegedContract","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"Redeem","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_contract","type":"address"}],"name":"RemovedPrivilegedContract","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"_trustedDeFiContract","type":"address"}],"name":"addPrivilegedContract","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"addToBlockedList","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"},{"internalType":"address","name":"_spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_blockedUser","type":"address"}],"name":"destroyBlockedFunds","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"_name","type":"string"},{"internalType":"string","name":"_symbol","type":"string"},{"internalType":"uint8","name":"_decimals","type":"uint8"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"isBlocked","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"isTrusted","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_destination","type":"address"},{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address[]","name":"_recipients","type":"address[]"},{"internalType":"uint256[]","name":"_values","type":"uint256[]"}],"name":"multiTransfer","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"redeem","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"removeFromBlockedList","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_trustedDeFiContract","type":"address"}],"name":"removePrivilegedContract","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_recipient","type":"address"},{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_sender","type":"address"},{"internalType":"address","name":"_recipient","type":"address"},{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}];
      break
    case '0x6e109e9dd7fa1a58bc3eff667e8e41fc3cc07aef':
      abi = [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_upgradedAddress","type":"address"}],"name":"deprecate","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"deprecated","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_evilUser","type":"address"}],"name":"addBlackList","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"upgradedAddress","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"maximumFee","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"unpause","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"account","type":"address"}],"name":"isPauser","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_maker","type":"address"}],"name":"getBlackListStatus","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"paused","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_subtractedValue","type":"uint256"}],"name":"decreaseApproval","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"renouncePauser","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"who","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"renounceOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"account","type":"address"}],"name":"addPauser","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"pause","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"isOwner","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"who","type":"address"}],"name":"oldBalanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"newBasisPoints","type":"uint256"},{"name":"newMaxFee","type":"uint256"}],"name":"setParams","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"issue","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_addedValue","type":"uint256"}],"name":"increaseApproval","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"redeem","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"remaining","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"basisPointsRate","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"isBlackListed","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_clearedUser","type":"address"}],"name":"removeBlackList","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"MAX_UINT","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_blackListedUser","type":"address"}],"name":"destroyBlackFunds","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[{"name":"_initialSupply","type":"uint256"},{"name":"_name","type":"string"},{"name":"_symbol","type":"string"},{"name":"_decimals","type":"uint8"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_blackListedUser","type":"address"},{"indexed":false,"name":"_balance","type":"uint256"}],"name":"DestroyedBlackFunds","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"amount","type":"uint256"}],"name":"Issue","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"amount","type":"uint256"}],"name":"Redeem","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"newAddress","type":"address"}],"name":"Deprecate","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_user","type":"address"}],"name":"AddedBlackList","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_user","type":"address"}],"name":"RemovedBlackList","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"feeBasisPoints","type":"uint256"},{"indexed":false,"name":"maxFee","type":"uint256"}],"name":"Params","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"previousOwner","type":"address"},{"indexed":true,"name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"account","type":"address"}],"name":"Paused","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"account","type":"address"}],"name":"Unpaused","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"account","type":"address"}],"name":"PauserAdded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"account","type":"address"}],"name":"PauserRemoved","type":"event"}];
      break
    case '0xed03ed872159e199065401b6d0d487d78d9464aa':
      abi = [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_user","type":"address"}],"name":"BlockPlaced","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_user","type":"address"}],"name":"BlockReleased","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_blockedUser","type":"address"},{"indexed":false,"internalType":"uint256","name":"_balance","type":"uint256"}],"name":"DestroyedBlockedFunds","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_destination","type":"address"},{"indexed":false,"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"Mint","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"Redeem","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[],"name":"DOMAIN_SEPARATOR","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"addToBlockedList","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_blockedUser","type":"address"}],"name":"destroyBlockedFunds","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"_name","type":"string"},{"internalType":"string","name":"_symbol","type":"string"},{"internalType":"uint8","name":"_decimals","type":"uint8"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"isBlocked","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"isTrusted","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_destination","type":"address"},{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address[]","name":"_recipients","type":"address[]"},{"internalType":"uint256[]","name":"_values","type":"uint256[]"}],"name":"multiTransfer","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"nonces","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"permit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"redeem","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"removeFromBlockedList","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_recipient","type":"address"},{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_sender","type":"address"},{"internalType":"address","name":"_recipient","type":"address"},{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}];
      break
    case '0x68749665ff8d2d112fa859aa293f07a622782f38':
      abi = [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_user","type":"address"}],"name":"BlockPlaced","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_user","type":"address"}],"name":"BlockReleased","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_blockedUser","type":"address"},{"indexed":false,"internalType":"uint256","name":"_balance","type":"uint256"}],"name":"DestroyedBlockedFunds","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_destination","type":"address"},{"indexed":false,"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"Mint","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"Redeem","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[],"name":"DOMAIN_SEPARATOR","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"addToBlockedList","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_blockedUser","type":"address"}],"name":"destroyBlockedFunds","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"_name","type":"string"},{"internalType":"string","name":"_symbol","type":"string"},{"internalType":"uint8","name":"_decimals","type":"uint8"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"isBlocked","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"isTrusted","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_destination","type":"address"},{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address[]","name":"_recipients","type":"address[]"},{"internalType":"uint256[]","name":"_values","type":"uint256[]"}],"name":"multiTransfer","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"nonces","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"permit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"redeem","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"removeFromBlockedList","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_recipient","type":"address"},{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_sender","type":"address"},{"internalType":"address","name":"_recipient","type":"address"},{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}];
      break
  }
  return abi;
}

function getContract(id,isAddress=false) {
  let address;
  if (isAddress) {
    address = id.toLowerCase();
  } else {
    switch (id.toUpperCase()) {
      case 'ADMIN':
        address = '0xc6cde7c39eb2f0f0095f41570af89efc2c1ea828';
        break
      case 'MXNT':
        address = '0xed03ed872159e199065401b6d0d487d78d9464aa';
        break
      case 'CNHT':
        address = '0x6e109e9dd7fa1a58bc3eff667e8e41fc3cc07aef';
        break
      case 'EURT':
        address = '0xc581b735a1688071a1746c968e0798d642ede491';
        break
      case 'XAUT':
        address = '0x68749665ff8d2d112fa859aa293f07a622782f38';
        break
      case 'USDT':
        address = '0xdac17f958d2ee523a2206206994597c13d831ec7';
        break
      default:
        console.log(`Unknown contract for ${id}`);
        process.exit(0);
    }
  }
  let abi = contractAbiList(address);
  let contract = new web3.eth.Contract(abi, address);
  return contract;
}

let txHashes = []

async function createLedger() {
  console.log('Ledger initialized');
  const transport = await Transport.create();
  return new AppEth(transport);
}

function padLeftZeros(stringItem) {
  return stringItem.padStart(64, '0');
}

function isValidUuidV4(uuid) {
  const uuidV4Regex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  return uuidV4Regex.test(uuid);
}

function getTxData(nonce, data, gasLimit, gasPrice, maxFeePerGas, contractAddress) {
  return {
    data,
    nonce: web3.utils.toHex(nonce),
    gasLimit: web3.utils.toHex(gasLimit),
    maxPriorityFeePerGas: web3.utils.toHex(gasPrice),
    maxFeePerGas: web3.utils.toHex(maxFeePerGas),
    to: contractAddress,
    value: '0x00',
    r: web3.utils.toHex(chainId),
    v: '0x',
    s: '0x',
  };
}


async function decodeBundleTxs(txList) {
  let retval=[]
  let nextTx = '-';
  try {
    nextTx = parseInt(await adminMSIG.methods.transactionCount().call());
  } catch (err) {
    console.log(`Tried to get transaction count for contract ${adminMSIG._address}, but got err: ${err}`);
  }

  for (const rawTxHex of txList){
    let dtx = decodeRawHex(rawTxHex);
    let dest = dtx.to;
    let data = dtx.data;
    let from = dtx.from;
    let contractABI = contractAbiList(dest);
    let dd = abiDecode(contractABI,data);
    if (dd['function']=='submitTransaction') {
      let destContract = getContract(dest,true);
      let exDest = dd['data'][0];
      let exData = dd['data'][2];
      let exDD = decodeData(exData);
      retval.push(`${nextTx}*,${exDest},${exDD['method']},${exDD['addr']},${exDD['value']},${from}`);
      try {
        nextTx = nextTx + 1;
      } catch (err)  {
        //couldn't figure out next txid
      }
    } else {
      retval.push(`${parseInt(dd['data'][0])}*,${dest},${dd['function']},-,-,${from}`);
    }
  }
  return retval;
}

function decodeRawHex(rawTxHex){
  const decodedTx = Transaction.from(rawTxHex);
  let jsonTx = decodedTx.toJSON();
  jsonTx.from = decodedTx.from;
  return jsonTx;
}

function abiDecode(contractABI, inputData) {
  let retval={}

  const functionSelector = inputData.slice(0, 10);
  const matchingFunction = contractABI.find(
    (method) => {
      if (method.name) {
        const signature = web3.eth.abi.encodeFunctionSignature(method);
        return signature === functionSelector;
      }
      return false;
    }
  );

  if (matchingFunction) {
    // Get the encoded parameters by removing the function selector
    const encodedParameters = inputData.slice(10);

    // Get the types of the input parameters from the ABI
    const parameterTypes = matchingFunction.inputs.map((input) => input.type);

    // Decode the parameters
    const decodedParameters = web3.eth.abi.decodeParameters(
      parameterTypes,
      encodedParameters
    );

    retval['function']=matchingFunction.name
    retval['data']=decodedParameters
  } else {
    console.log('Function not found in ABI.');
  }
  return retval;
}

function decodeData(hex) {

  let method,addr,value;

  switch (hex.slice(0,10)) {
    case '0x0ecb93c0':
      method = 'addBlackList';
      addr = '0x'+hex.slice(34,74);
      value = 0;
      break;
    case '0x3c7c9b90':
      method = 'addToBlockedList';
      addr = '0x'+hex.slice(34,74);
      value = 0;
      break;
    case '0xf3bdc228':
      method = 'destroyBlackFunds';
      addr = '0x'+hex.slice(34,74);
      value = 0;
      break;
    case '0x0e27a385':
      method = 'destroyBlockedFunds';
      addr = '0x'+hex.slice(34,74);
      value = 0;
      break;
    case '0xe4997dc5':
      method = 'removeBlackList';
      addr = '0x'+hex.slice(34,74);
      value = 0;
      break;
    case '0x1a14f449':
      method = 'removeFromBlockedList';
      addr = '0x'+hex.slice(34,74);
      value = 0;
      break;
    case '0x7065cb48':
      method = 'addOwner';
      addr = '0x'+hex.slice(34,74);
      value = 0;
      break;
    case '0x173825d9':
      method = 'removeOwner';
      addr = '0x'+hex.slice(34,74);
      value = 0;
      break;
    case '0xe20056e6':
      method = 'replaceOwner';
      addrA = '0x'+hex.slice(34,74);
      addrB = '0x'+hex.slice(98,138);
      addr = addrA+'->'+addrB
      value = 0;
      break;
    case '0xcc872b66':
      method = 'issue';
      addr = '';
      value = parseInt(hex.slice(10,74).replace(/\b0+/g, ''),16)/1e6;
      break;
    case '0x40c10f19':
      method = 'mint';
      addr = '0x'+hex.slice(34,74);
      value = parseInt(hex.slice(74,138).replace(/\b0+/g, ''),16)/1e6;
      break;
    case '0xdb006a75':
      method = 'redeem';
      addr = '';
      value = parseInt(hex.slice(10,74).replace(/\b0+/g, ''),16)/1e6;
      break;
    case '0xa9059cbb':
      method = 'transfer';
      addr = '0x'+hex.slice(34,74);
      value = parseInt(hex.slice(74,138).replace(/\b0+/g, ''),16)/1e6;
      break;
    case '0x8456cb59':
      method = 'pause';
      addr = '';
      value = 0;
      break;
    case '0x99a88ec4':
      method = 'proxy-upgrade';
      addr = '0x'+hex.slice(34,74);
      value = '0x'+hex.slice(98,138);
      break;
    case '0x0753c30c':
      method = 'deprecate';
      addr = '0x'+hex.slice(34,74);
      value = 0;
      break;
    case '0x4e71e0c8':
      method = 'claimOwnership';
      value = 0;
      addr = '';
      break
    case '0x078dfbe7':
      method = 'transferOwnership';
      addr = '0x'+hex.slice(34,74);
      direct = parseInt(hex.slice(74,138));
      renounce = parseInt(hex.slice(138,276));
      value = `Direct:${direct},Renounce:${renounce}`;
      break
    case '0x62a5af3b':
      method = 'freezeOracle';
      value = 0;
      addr = '';
      break
    case '0x6a28f000':
      method = 'unfreezeOracle';
      value = 0;
      addr = '';
      break
    case '0xabee062b':
      method = 'setMaximumDeltaPercentage';
      value = parseInt(hex.slice(10,74).replace(/\b0+/g, ''),16)/1e6;
      addr = '';
      break
    case '0x558a7297':
      method = 'setOperator';
      addr = '0x'+hex.slice(34,74);
      value = parseInt(hex.slice(74,138));
      break;
    case '0xe5a98603':
      method = 'setThreshold'
      value = parseInt(hex.slice(10,74).replace(/\b0+/g, ''),16);
      addr = '';
      break;
    default:
      method = 'unknown';
      value = 0;
      addr = '';
  }
  return {'method':method,'value':value,'addr':addr}
}


async function updateGas(baseGas = 2) {
  let ethGasStationData = await request.get({
    url: `https://api.etherscan.io/v2/api?chainid=1&module=gastracker&action=gasoracle&apikey=${config.etherscanApiKey}`,
    json: true,
  });
  if (ethGasStationData.status === '1') {
    let gasPrice = parseInt(ethGasStationData.result.FastGasPrice) - parseInt(ethGasStationData.result.ProposeGasPrice);
    if (gasPrice < baseGas) {
      gasPrice = baseGas
    }
    let maxFeePerGas = ((parseInt(ethGasStationData.result.suggestBaseFee) * 2) + gasPrice) * 10e8;
    return { gasPrice, maxFeePerGas };
  } else {
    console.log('Error fetching gas data');
    process.exit(1);
  }
}

async function broadcast(signedtx) {
  console.log('Broadcasting...');
  try {
    await web3.eth.sendSignedTransaction(signedtx, (err, hash) => {
      if (err) console.log('Broadcast Failed:', err.message);
      else console.log(hash);
    });
  } catch (err) {
    console.log('Broadcast Failed:', err.message);
  }
}

async function broadcastEtherscan(signedtx) {
  console.log('Broadcasting to Etherscan...');
  try {
    let response = await request({
      url: `https://api.etherscan.io/v2/api?chainid=1&module=proxy&action=eth_sendRawTransaction&hex=${signedtx}&apikey=${config.etherscanApiKey}`,
      json: true,
    });
    console.log(response.result);
  } catch (err) {
    console.log('Etherscan Broadcast Failed:', err.message);
  }
}

async function getFlashbotBundleCache(uuid) {
  let flashbotBundleData = await request.get({
    url: `https://rpc.flashbots.net/bundle?id=${uuid}`,
    json: true,
  });
  if (flashbotBundleData.rawTxs.size == 0) {
    console.log(`Error, Flashbot Bundle Cache ${uuid} is empty`);
    //process.exit(1);
  }
  return flashbotBundleData.rawTxs;
}

async function broadcastFlashbot(signedtx, bUUID='') {
  let rpcurl='https://rpc.flashbots.net/fast';

  if (bUUID.length>0) {
    rpcurl=`https://rpc.flashbots.net?bundle=${bUUID}`;
    console.log("Queueing transaction in Bundle: \x1b[32m%s\x1b[0m",bUUID);
  } else {
    console.log('Broadcasting to Flashbot...');
  }
  try {
    let response = await request.post({
      headers: { 'content-type': 'application/json' },
      url: rpcurl,
      body: {
        jsonrpc: '2.0',
        method: 'eth_sendRawTransaction',
        params: [signedtx],
        id: 1,
      },
      json: true,
    });
    if (response.error) {
      console.log('Flashbot Broadcast Error:', response.error.message);
    } else {
      console.log(response.result);
      if (bUUID.length>0) {
        console.log("TX inserted into Flashbot Bundle Cache");
      } else {
        txHashes.push(response.result);
      }
    }
  } catch (err) {
    console.log("Flashbot Broadcast Failed: \x1b[32m%s\x1b[0m",err)
  }
}

async function generateFlashbotSignature(msg) {
  let bundlePhrase = Wallet.createRandom().mnemonic.phrase;
  let bundlePhraseFile = '.flashbot.reputation'

  try {
    const data = fs.readFileSync(bundlePhraseFile, 'utf8');
    // File exists, use mnemonic from file
    bundlePhrase = data;
  } catch (err) {
    if (err.code === 'ENOENT') {
      // File does not exist, create it and write mnemonic
      fs.writeFile(bundlePhraseFile, bundlePhrase, 'utf8', (writeErr) => {
        if (writeErr) {
          console.error('Error writing to file:', writeErr);
        } else {
          console.log(`New flashbot reputation mnemonic created and stored in ${bundlePhraseFile}.`);
        }
      });
    } else {
      // Other error during file reading
      console.error('Error reading bundlePhraseFile:', err);
    }
  }

  let wallet = Wallet.fromPhrase(bundlePhrase);
  let signature = wallet.address + ':' + await wallet.signMessage(id(JSON.stringify(msg)));
  return signature;
}

async function broadcastFlashbotBundle(signedtxarray, simulate=false) {
  let targetBlock = parseInt(await web3.eth.getBlockNumber()) + 1 ;
  let retval = {'hash':'','target':0};

  console.log('Generating Bundle Signature for target block',targetBlock);

  let body = {
        jsonrpc: '2.0',
        method: 'eth_sendBundle',
        params: [{
          txs: signedtxarray,
          blockNumber: web3.utils.toHex(targetBlock),
          builders: ["flashbots","f1b.io","rsync","beaverbuild.org","builder0x69","Titan","EigenPhi","boba-builder","Gambit Labs","payload","Loki","BuildAI","JetBuilder","tbuilder","penguinbuild","bobthebuilder","BTCS","bloXroute","Blockbeelder","Quasar","Eureka"]
        }],
        id: 1,
      }

  if (simulate) {
    body['method'] = 'eth_callBundle'
    body['params'][0]['stateBlockNumber'] = 'latest'
  }

  let signature = await generateFlashbotSignature(body);

  //console.log(signature);
  console.log('Broadcasting to Flashbot...');
  try {
    let response = await request.post({
      headers: {
        'content-type': 'application/json',
        'X-Flashbots-Signature': signature
      },
      url: 'https://relay.flashbots.net',
      body: body,
      json: true,
    });
    if (response.error) {
      console.log('Flashbot Broadcast Error:', response.error.message);
      console.log(response.error);
    } else {
      //console.log(response.result.bundleHash);
      console.log(response.result);
      retval = {
        'hash': response.result.bundleHash,
        'target': targetBlock,
      }
    }
  } catch (err) {
    console.log("Flashbot Broadcast Failed: \x1b[32m%s\x1b[0m",err)
  }
  return retval;
}

async function bundleRebroadcast(txarray,limit=15) {
  let bundleDetails = await broadcastFlashbotBundle(txarray);
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('Finished')
  let hash = bundleDetails['hash']
  let target = bundleDetails['target'];
  console.log('Querying status of bundle',hash, 'in block', target);

  while (true) {
    const block = parseInt(await web3.eth.getBlockNumber());

    console.log(`Current block: ${block} / ${target}`);

    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    if (block >= target) {
      break;
    }
  }

  let exists = false;
  try {
    let checkHash = web3.utils.sha3(txarray[0])
    exists = (await web3.eth.getTransaction(checkHash)).hash == checkHash;
  } catch(e) {
    //broadcast failed
  }

  limit-=1;
  if (exists) {
    console.log("Bundle broadcast successfully");
  } else {
    if (limit > 0) {
      console.log(`Bundle not included by target block, retrying. ${limit} attempts left.`);
      await bundleRebroadcast(txarray,limit);
    } else {
      console.log("Bundle Broadcast failed retry limit reached")
    }
  }

}

//Deprecated endpoints
/*
async function flashbots_getUserStatsV2() {
  let targetBlock = parseInt(await web3.eth.getBlockNumber());

  let body = {
        jsonrpc: '2.0',
        id: 1,
        method: 'flashbots_getUserStatsV2',
        params: [{
          blockNumber: web3.utils.toHex(targetBlock),
        }],
      }

  let signature = await generateFlashbotSignature(body);

  try {
    let response = await request.post({
      headers: {
        'content-type': 'application/json',
        'X-Flashbots-Signature': signature
      },
      url: 'https://relay.flashbots.net',
      body: body,
      json: true,
    });
    if (response.error) {
      console.log('Flashbot Query Error:', response.error.message);
    } else {
      console.log(response);
    }
  } catch (err) {
    console.log("Flashbot Query Failed: \x1b[32m%s\x1b[0m",err)
  }
}

async function flashbots_getBundleStatsV2(hash,target) {
  console.log('Generating Bundle Signature...');
  let body = {
        jsonrpc: '2.0',
        method: 'flashbots_getBundleStatsV2',
        params: [{
          bundleHash: hash,
          blockNumber: web3.utils.toHex(target),
        }],
        id: 1,
      }

  let signature = await generateFlashbotSignature(body);

  console.log(signature);

  try {
    let response = await request.post({
      headers: {
        'content-type': 'application/json',
        'X-Flashbots-Signature': signature
      },
      url: 'https://relay.flashbots.net',
      body: body,
      json: true,
    });
    if (response.error) {
      console.log('Flashbot Broadcast Error:', response.error.message);
    } else {
      console.log(response);
      return response;
    }
  } catch (err) {
    console.log("Flashbot Broadcast Failed: \x1b[32m%s\x1b[0m",err)
  }
}
*/



module.exports = {
  createLedger,
  padLeftZeros,
  isValidUuidV4,
  getTxData,
  decodeBundleTxs,
  decodeData,
  updateGas,
  broadcast,
  broadcastEtherscan,
  broadcastFlashbot,
  broadcastFlashbotBundle,
  bundleRebroadcast,
  getFlashbotBundleCache,
  web3,
  common,
  FeeMarketEIP1559Transaction,
  bytesToHex,
  ledgerService,
  askQuestion,
  adminMSIG,
  tetherUSDT,
  tetherEURT,
  tetherCNHT,
  tetherMXNT,
  tetherXAUT,
  txHashes,
  fs,
};
