'use strict'

const Transport = require('@ledgerhq/hw-transport-node-hid').default
const AppEth = require('@ledgerhq/hw-app-eth').default
const config = require('./ethConfig.json')
//= =============
const createLedger = async () => {
  const transport = await Transport.create()
  return new AppEth(transport)
}

const sign = async (ledger, msg) => {
  console.log('Requesting to sign')
  let addr = await ledger.getAddress(config.hd_path)
  console.log('From:', addr.address)
  const result = await ledger.signPersonalMessage(config.hd_path, msg)
  console.log('Message:', Buffer.from(msg,'hex').toString())
  const signature = '0x' + result.r + result.s + result.v.toString(16)
  console.log('Signature:', signature)
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
