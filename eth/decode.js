function decodeData(hex) {

  switch (hex.slice(0,10)) {
    case '0x0ecb93c0':
      //'0x0ecb93c0000000000000000000000000':
      method = 'blackList';
      addr = '0x'+hex.slice(34);
      value = 0;
      break;
    case '0xf3bdc228':
      //'0xf3bdc228000000000000000000000000':
      method = 'destroyBlackFunds';
      addr = '0x'+hex.slice(34);
      value = 0;
      break;
    case '0xe4997dc5':
      //'0xe4997dc5000000000000000000000000':
      method = 'removeBlackList';
      addr = '0x'+hex.slice(34);
      value = 0;
      break;
    case '0x7065cb48':
      //'0x7065cb48000000000000000000000000':
      method = 'addOwner';
      addr = '0x'+hex.slice(34);
      value = 0;
      break;
    case '0xcc872b66':
      method = 'issue';
      addr = '';
      value = parseInt(hex.slice(10).replace(/\b0+/g, ''),16)/1e6;
      break;
    case '0xdb006a75':
      method = 'redeem';
      addr = '';
      value = parseInt(hex.slice(10).replace(/\b0+/g, ''),16)/1e6;
      break;
    case '0xa9059cbb':
      method = 'transfer';
      addr = '0x'+hex.slice(10,74).replace(/\b0+/g, '');
      value = parseInt(hex.slice(74).replace(/\b0+/g, ''),16)/1e6;;
      break;
    default:
      method = 'unknown';
      value = 0;
      addr = '';
  }
  return {'method':method,'value':value,'addr':addr}
}

module.exports = {decodeData}
