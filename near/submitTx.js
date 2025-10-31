#!/usr/bin/env node
/**
 * Usage: node script.js <action> <target>
 * Example: node script.js Go car
 */

const { exec } = require("child_process");
const { ADMIN_SIGNING_ADDRESS, HD_PATH } = require('./config');

// Grab inputs from command line
const action = process.argv[2];
const target = process.argv[3];

if (!action || !target) {
  console.error("Usage: node script.js <action> <target>");
  console.error("options for <action> = [freeze, unfreeze, destroy, mint, confirm, unconfirm]");
  console.error("<action>=mint, target=amount with full decimal extrapolation, ie. 100Million = 100000000000000");
  process.exit(1);
}

/**
 * Base64-encode a string input.
 * @param {string} input - The string to encode.
 * @returns {string} Base64-encoded result.
 */
function base64Encode(input) {
  return Buffer.from(input, "utf8").toString("base64");
}

const CONTRACT = "usdt.tether-token.near";
const MSIG = "tether.multisafe.near";
const NETWORK = 'mainnet';
//const NETWORK = 'testnet';


let pargs;
let b64;
let args;
let command;
let method;
let eCMD;

let adminCMD=false;

switch (action.toLowerCase()) {
  case "freeze":
    pargs = `{"account_id": "${target}"}`;
    method = "add_to_blacklist";
    break;

  case "unfreeze":
    pargs = `{"account_id": "${target}"}`;
    method = "remove_from_blacklist";
    break;

  case "destroy":
    pargs = `{"account_id": "${target}"}`;
    method = "destroy_black_funds";
    break;

  case "mint":
    pargs = `{"account_id": "tether-treasury.near", "amount":"${target}"}`;
    method = "mint";
    break;

  case "confirm":
    adminCMD=true;
    method = "confirm"
    break;

  case "unconfirm":
    adminCMD=true;
    method = "delete_request";
    break;

  default:
    console.error(`Unknown action: ${action}`);
    process.exit(1);
}

if (adminCMD) {
  args = `{"request_id":${target}}`
  eCMD = `${method} json-args '${args}'`;
} else {
  b64 = base64Encode(pargs);
  args=`{"request":{"receiver_id": "${CONTRACT}", "actions":[{"type":"FunctionCall", "method_name":"${method}", "args":"${b64}", "deposit":"0", "gas":"50000000000000"}]}}`
  eCMD = `add_request_and_confirm json-args '${args}'`;
}

command = `near contract call-function as-transaction ${MSIG} ${eCMD} prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' sign-as ${ADMIN_SIGNING_ADDRESS} network-config ${NETWORK} sign-with-ledger --seed-phrase-hd-path "${HD_PATH}" send`

console.log(command);

// Execute the command on the system shell
exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error executing command: ${error.message}`);
    process.exit(1);
  }

  if (stderr) {
    console.error(`stderr: ${stderr}`);
  }

  console.log(`stdout: ${stdout}`);
});

