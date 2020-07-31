'use strict'

const Transport = require('@ledgerhq/hw-transport-node-hid').default
const AppEth = require('@ledgerhq/hw-app-eth').default
const config = require('./config.json')
//= =============
const createLedger = async () => {
  const transport = await Transport.create()
  return new AppEth(transport)
}

const sign = async (ledger, msg) => {
  console.log('Requesting to sign')
  const result = await ledger.signPersonalMessage(config.hd_path, msg)
  console.log('Signed: ')
  console.log(result)
  const v = result.v + 27 + 4
  const signature = Buffer.from(v.toString(16) + result.r + result.s, 'hex').toString('base64')
  console.log('Signature : ' + signature)
  return signature
}

const msg = process.argv[2]
const msgHex = Buffer.from(msg).toString('hex')
console.log(`Signing Message : ${msg}`)
console.log(`Signing Message HEX : ${msgHex}`)
createLedger()
  .then(async (ledger) => {
    console.log('Opened Ledger....')
    try {
      await sign(ledger, msgHex)
    } catch (err) {
      console.log(err)
    }
    console.log('Finished')
  })
