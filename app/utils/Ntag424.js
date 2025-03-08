import {Platform} from 'react-native';
import NfcManager, {NfcTech, Ndef} from 'react-native-nfc-manager';
import {randomBytes} from 'crypto';
import crc from 'crc';
import errorCodes, {
  isoSelectErrorCodes,
  changeKeyErrorCodes,
  changeFileSettingsErrorCodes,
} from './errorCodes';

var CryptoJS = require('./Cmac');
var AES = require('crypto-js/aes');

var Ntag424 = NfcManager;
Ntag424.ti = null;
Ntag424.sesAuthEncKey = null;
Ntag424.sesAuthMacKey = null;
Ntag424.cmdCtrDec = null;
Ntag424.util = {};

const hexToBytes = (Ntag424.util.hexToBytes = hex => {
  let bytes = [];
  for (let c = 0; c < hex.length; c += 2)
    bytes.push(parseInt(hex.substr(c, 2), 16));
  return bytes;
});

// Convert a byte array to a hex string
const bytesToHex = (Ntag424.util.bytesToHex = bytes => {
  let hex = [];
  for (let i = 0; i < bytes.length; i++) {
    let current = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    hex.push((current >>> 4).toString(16));
    hex.push((current & 0xf).toString(16));
  }
  return hex.join('');
});

function leftRotate(bytesArr, rotatebit = 1) {
  let first = bytesArr.shift();
  bytesArr.push(first);
  return bytesArr;
}

//Encrypted IV
function ivEncryption(ti, cmdCtr, sesAuthEncKey) {
  const ivData = AES.encrypt(
    CryptoJS.enc.Hex.parse('A55A' + ti + cmdCtr + '0000000000000000'),
    CryptoJS.enc.Hex.parse(sesAuthEncKey),
    {
      mode: CryptoJS.mode.ECB,
      // iv: CryptoJS.enc.Hex.parse("00000000000000000000000000000000"),
      keySize: 128 / 8,
      padding: CryptoJS.pad.NoPadding,
    },
  );
  return ivData.ciphertext.toString(CryptoJS.enc.Hex);
}

function ivEncryptionResponse(ti, cmdCtr, sesAuthEncKey) {
  const ivData = AES.encrypt(
    CryptoJS.enc.Hex.parse('5AA5' + ti + cmdCtr + '0000000000000000'),
    CryptoJS.enc.Hex.parse(sesAuthEncKey),
    {
      mode: CryptoJS.mode.ECB,
      // iv: CryptoJS.enc.Hex.parse("00000000000000000000000000000000"),
      keySize: 128 / 8,
      padding: CryptoJS.pad.NoPadding,
    },
  );
  return ivData.ciphertext.toString(CryptoJS.enc.Hex);
}

function padForEnc(data, byteLen) {
  console.log('padforenc', data, data.length, byteLen);
  var paddedData = data;
  if (data.length < byteLen * 2) {
    console.log('padforEnc22', byteLen * 2);
    paddedData += '80';
    paddedData = paddedData.padEnd(byteLen * 2, '00');
  }
  return paddedData;
}
/**
 * Decimal to Hex Least sig bytes first
 * @param {int} dec decimal value
 * @param {int} bytes how many bytes you want the hex to be
 * @returns
 */
function decToHexLsbFirst(dec, bytes) {
  //lsb first
  return dec
    .toString(16)
    .padStart(2, '0')
    .padEnd(bytes * 2, '0');
}

/**
 * Sends the ADPU command using appropriate function for ios / android
 * creates the same return object for each platform
 *
 * @param {byte[]} commandBytes
 * @returns {response, sw1, sw2}
 */
Ntag424.sendAPDUCommand = async function (commandBytes) {
  const response =
    Platform.OS == 'ios'
      ? await NfcManager.sendCommandAPDUIOS(commandBytes)
      : await NfcManager.transceive(commandBytes);
  var newResponse = response;
  if (Platform.OS == 'android') {
    newResponse = {};
    newResponse.response = response.slice(0, -2);
    newResponse.sw1 = response.slice(-2, -1);
    newResponse.sw2 = response.slice(-1);
  }
  return newResponse;
};

/**
 * Selects the application file
 * @returns
 */
Ntag424.isoSelectFileApplication = async function () {
  //For selecting the application immediately, the ISO/IEC 7816-4 DF name D2760000850101h can be used.
  const isoSelectFileBytes = hexToBytes('00A4040007D276000085010100');
  const isoSelectRes = await Ntag424.sendAPDUCommand(isoSelectFileBytes);
  console.log(
    'isoSelectRes: ',
    bytesToHex([isoSelectRes.sw1, isoSelectRes.sw2]),
  );
  const resultHex = bytesToHex([isoSelectRes.sw1, isoSelectRes.sw2]);
  if (resultHex == '9000') {
    return Promise.resolve(resultHex);
  } else {
    return Promise.reject(
      'ISO Select File Failed, code ' +
        resultHex +
        ' ' +
        isoSelectErrorCodes[resultHex],
    );
  }
};

/**
 * AuthEv2First
 * COMMMODE N/A
 * @param {string} keyNo key number in hex (1 byte)
 * @param {string} pKey key value in hex (16 bytes)
 * @returns
 *
 * CommMode N/A
 */
Ntag424.AuthEv2First = async function (keyNo, pKey) {
  //iso select file before auth
  try {
    await Ntag424.isoSelectFileApplication();

    const bytes = hexToBytes('9071000005' + keyNo + '0300000000');
    const Result = await Ntag424.sendAPDUCommand(bytes);
    console.warn('Result: ', bytesToHex([Result.sw1, Result.sw2]));
    const resultData = bytesToHex(Result.response);
    //91AF is the successful code
    const resultCode = bytesToHex([Result.sw1, Result.sw2]);
    if (resultCode == '91af') {
      const key = CryptoJS.enc.Hex.parse(pKey);
      const iv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');
      const aesEncryptOption = {
        padding: CryptoJS.pad.NoPadding,
        mode: CryptoJS.mode.CBC,
        iv: iv,
        keySize: 128 / 8,
      };
      const RndBDec = AES.decrypt(
        {ciphertext: CryptoJS.enc.Hex.parse(resultData)},
        key,
        aesEncryptOption,
      );
      const RndB = CryptoJS.enc.Hex.stringify(RndBDec);
      const RndABytes = randomBytes(16);
      const RndA = bytesToHex(RndABytes);
      const RndBRotlBytes = leftRotate(hexToBytes(RndB));
      const RndBRotl = bytesToHex(RndBRotlBytes);

      const RndARndBRotl = RndA + RndBRotl;
      const RndARndBEncData = AES.encrypt(
        CryptoJS.enc.Hex.parse(RndARndBRotl),
        key,
        aesEncryptOption,
      );
      const RndARndBEnc = RndARndBEncData.ciphertext.toString(CryptoJS.enc.Hex);

      const secondAuthBytes = hexToBytes('90AF000020' + RndARndBEnc + '00');
      const secondAuthRes = await Ntag424.sendAPDUCommand(secondAuthBytes);
      console.warn(
        'Result: ',
        bytesToHex([secondAuthRes.sw1, secondAuthRes.sw2]),
      );
      //9100 is the successful code
      const secondAuthResultCode = bytesToHex([
        secondAuthRes.sw1,
        secondAuthRes.sw2,
      ]);
      if (secondAuthResultCode == '9100') {
        //auth successful
        const secondAuthResultData = bytesToHex(secondAuthRes.response);
        const secondAuthResultDataDec = AES.decrypt(
          {ciphertext: CryptoJS.enc.Hex.parse(secondAuthResultData)},
          key,
          aesEncryptOption,
        );
        const secondAuthResultDataDecStr = CryptoJS.enc.Hex.stringify(
          secondAuthResultDataDec,
        );

        const tiBytes = hexToBytes(secondAuthResultDataDecStr).slice(0, 4);
        const ti = bytesToHex(tiBytes);

        var WordArray = CryptoJS.lib.WordArray;
        const xor = CryptoJS.ext.xor(
          new WordArray.init(hexToBytes(RndA.slice(4, 16))),
          new WordArray.init(hexToBytes(RndB.slice(0, 12))),
        );
        let svPost = RndA.slice(0, 4);
        svPost += bytesToHex(xor.words);
        svPost += RndB.slice(12, 32) + RndA.slice(16, 32);
        //SV1 = A5h||5Ah||00h||01h||00h||80h||RndA[15..14]|| ( RndA[13..8] # RndB[15..10])||RndB[9..0]||RndA[7..0]
        let sv1 = 'A55A00010080';
        sv1 += svPost;
        const sesAuthEnc = CryptoJS.CMAC(key, CryptoJS.enc.Hex.parse(sv1));
        const sesAuthEncKey = sesAuthEnc.toString();

        //SV2 = 5Ah||A5h||00h||01h||00h||80h||RndA[15..14]|| ( RndA[13..8] # RndB[15..10])||RndB[9..0]||RndA[7..0]
        //# == XOR-operator

        let sv2 = '5AA500010080';
        sv2 += svPost;
        const sesAuthMac = CryptoJS.CMAC(key, CryptoJS.enc.Hex.parse(sv2));
        const sesAuthMacKey = sesAuthMac.toString();
        Ntag424.ti = ti;
        Ntag424.sesAuthMacKey = sesAuthMacKey;
        Ntag424.sesAuthEncKey = sesAuthEncKey;
        Ntag424.cmdCtrDec = 0;
        return Promise.resolve({sesAuthEncKey, sesAuthMacKey, ti});
      } else {
        //auth failed
        return Promise.reject(
          'Auth Failed, code ' +
            secondAuthResultCode +
            ' ' +
            errorCodes[secondAuthResultCode],
        );
      }
    } else {
      //auth failed
      return Promise.reject(
        'Auth Failed, code ' + resultCode + ' ' + errorCodes[resultCode],
      );
    }
  } catch (ex) {
    return Promise.reject(ex);
  }
};

/**
 * AuthEv2NonFirst
 * CommMode N/A
 * @param {string} keyNo key number in hex (1 byte)
 * @param {string} pKey key value in hex (16 bytes)
 * @returns
 */
Ntag424.AuthEv2NonFirst = async (keyNo, pKey) => {
  const bytes = hexToBytes('9077000001' + keyNo + '00');
  const Result = await Ntag424.sendAPDUCommand(bytes);
  console.warn(
    'auth ev2 non first part 1 Result: ',
    bytesToHex([Result.sw1, Result.sw2]),
  );
  const resultData = bytesToHex(Result.response);
  //91AF is the successful code
  const resultCode = bytesToHex([Result.sw1, Result.sw2]);
  if (resultCode == '91af') {
    const key = CryptoJS.enc.Hex.parse(pKey);
    const iv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');
    const aesEncryptOption = {
      padding: CryptoJS.pad.NoPadding,
      mode: CryptoJS.mode.CBC,
      iv: iv,
      keySize: 128 / 8,
    };
    const RndBDec = AES.decrypt(
      {ciphertext: CryptoJS.enc.Hex.parse(resultData)},
      key,
      aesEncryptOption,
    );
    const RndB = CryptoJS.enc.Hex.stringify(RndBDec);
    const RndABytes = randomBytes(16);
    const RndA = bytesToHex(RndABytes);
    const RndBRotlBytes = leftRotate(hexToBytes(RndB));
    const RndBRotl = bytesToHex(RndBRotlBytes);

    const RndARndBRotl = RndA + RndBRotl;
    const RndARndBEncData = AES.encrypt(
      CryptoJS.enc.Hex.parse(RndARndBRotl),
      key,
      aesEncryptOption,
    );
    const RndARndBEnc = RndARndBEncData.ciphertext.toString(CryptoJS.enc.Hex);

    const secondAuthBytes = hexToBytes('90AF000020' + RndARndBEnc + '00');
    const secondAuthRes = await Ntag424.sendAPDUCommand(secondAuthBytes);
    console.warn(
      'auth ev2 non first part 2 Result: ',
      bytesToHex([secondAuthRes.sw1, secondAuthRes.sw2]),
    );
    //9100 is the successful code
    const secondAuthResultCode = bytesToHex([
      secondAuthRes.sw1,
      secondAuthRes.sw2,
    ]);
    if (secondAuthResultCode == '9100') {
      //auth successful
      return Promise.resolve('Successful');
    } else {
      //auth failed
      return Promise.reject(
        'Auth Failed, code ' +
          secondAuthResultCode +
          ' ' +
          errorCodes[secondAuthResultCode],
      );
    }
  } else {
    //auth failed
    return Promise.reject(
      'Auth Failed, code ' + resultCode + ' ' + errorCodes[resultCode],
    );
  }
};

/**
 * MACs the data and returns as a hex string
 *
 * @param {byte[]} commandData data to MAC
 * @returns
 */
Ntag424.calcMac = function (commandData) {
  const commandMac = CryptoJS.CMAC(
    CryptoJS.enc.Hex.parse(Ntag424.sesAuthMacKey),
    CryptoJS.enc.Hex.parse(commandData),
  );
  const commandMacHex = commandMac.toString();

  const truncatedMacBytes = hexToBytes(commandMacHex).filter(function (
    element,
    index,
    array,
  ) {
    return (index + 1) % 2 === 0;
  });
  return bytesToHex(truncatedMacBytes);
};

/**
 * Encrypts the data for CommMode.FULL
 * @param {string} cmdDataPadd Hex string of command data padded.
 * @param {byte[]} cmdCtr
 * @returns
 */
Ntag424.encData = function (cmdDataPadd, cmdCtr) {
  const iv = ivEncryption(Ntag424.ti, cmdCtr, Ntag424.sesAuthEncKey);
  const aesEncryptOption = {
    mode: CryptoJS.mode.CBC,
    iv: CryptoJS.enc.Hex.parse(iv),
    keySize: 128 / 8,
    padding: CryptoJS.pad.NoPadding,
  };

  return AES.encrypt(
    CryptoJS.enc.Hex.parse(cmdDataPadd),
    CryptoJS.enc.Hex.parse(Ntag424.sesAuthEncKey),
    aesEncryptOption,
  ).ciphertext.toString(CryptoJS.enc.Hex);
};
/**
 * Sets standard bolt card file settings using the picc offset and mac offset
 * CommMode Full
 *
 * @param {int} piccOffset picc offset
 * @param {int} macOffset mac offset
 * @returns
 */
Ntag424.setBoltCardFileSettings = (piccOffset, macOffset) => {
  //File Option SDM and mirroring enabled, CommMode: plain
  var cmdData = '40';
  //Access rights (FileAR.ReadWrite: 0x0, FileAR.Change: 0x0, FileAR.Read: 0xE, FileAR.Write; 0x0)
  cmdData += '00E0';
  //UID mirror: 1
  //SDMReadCtr: 1
  //SDMReadCtrLimit: 0
  //SDMENCFileData: 0
  //ASCII Encoding mode: 1
  cmdData += 'C1';
  //sdm access rights
  //RFU: 0F
  //CtrRet: 0F
  //MetaRead: 01
  //FileRead: 02
  cmdData += 'FF12';
  //ENCPICCDataOffset
  cmdData += piccOffset.toString(16).padEnd(6, '0');
  //SDMMACOffset
  cmdData += macOffset.toString(16).padEnd(6, '0');
  //SDMMACInputOffset
  cmdData += macOffset.toString(16).padEnd(6, '0');
  return Ntag424.changeFileSettings(cmdData);
};

/**
 * Clears the file settings back to default
 *
 * @returns
 */
Ntag424.resetFileSettings = () => {
  //File Option SDM and mirroring enabled, CommMode: plain
  var cmdData = '40';
  //Access rights (FileAR.ReadWrite: 0xE, FileAR.Change: 0x0, FileAR.Read: 0xE, FileAR.Write; 0xE)
  cmdData += 'E0EE';

  //UID mirror: 0
  // SDMReadCtr: 0
  // SDMReadCtrLimit: 0
  // SDMENCFileData: 0
  // ASCII Encoding mode: 1
  cmdData += '01';
  //sdm access rights
  //RFU: 0F
  //CtrRet: 0F
  //MetaRead: 0F
  //FileRead: 0F
  cmdData += 'FFFF';
  //no picc offset and mac offset
  return Ntag424.changeFileSettings(cmdData);
};
/**
 * Change File Settings
 * CommMode Full
 *
 * @param {int} piccOffset picc offset
 * @param {int} macOffset mac offset
 * @returns
 */
Ntag424.changeFileSettings = async cmdData => {
  const cmdHeader = '905F0000';

  const fileNo = '02';

  const cmdDataPadd = padForEnc(cmdData, 16);

  const cmdCtr = decToHexLsbFirst(Ntag424.cmdCtrDec++, 2);

  const encKeyData = Ntag424.encData(cmdDataPadd, cmdCtr);

  const commandData = '5F' + cmdCtr + Ntag424.ti + fileNo + encKeyData;

  const truncatedMac = Ntag424.calcMac(commandData);

  const data = encKeyData + truncatedMac;
  const lc = (data.length / 2 + 1).toString(16);
  const changeFileSettingsHex =
    cmdHeader + lc + fileNo + encKeyData + truncatedMac + '00';

  const changeFileSettingsRes = await Ntag424.sendAPDUCommand(
    hexToBytes(changeFileSettingsHex),
  );
  const resCode = bytesToHex([
    changeFileSettingsRes.sw1,
    changeFileSettingsRes.sw2,
  ]);
  console.warn('changeFileSettingsRes Result: ', resCode);
  if (resCode == '9100') {
    return Promise.resolve('Successful');
  } else {
    return Promise.reject(
      'Change file settings Failed, code ' +
        resCode +
        ' ' +
        changeFileSettingsErrorCodes[resCode],
    );
  }
};

/**
 * Change Key
 * CommMode full
 *
 * @param {string} sesAuthEncKey hex string (16 bytes)
 * @param {string} sesAuthMacKey hex string (16 bytes)
 * @param {string} ti hex string ( 4bytes)
 * @param {string} keyNo key number in hex (1 byte)
 * @param {string} key old key value in hex (16 bytes)
 * @param {string} newKey new key value in hex (16 bytes)
 * @param {string} keyVersion new key version in hex (1 byte)
 * @returns
 */
Ntag424.changeKey = async (keyNo, key, newKey, keyVersion) => {
  const cmdCtr = decToHexLsbFirst(Ntag424.cmdCtrDec++, 2);
  console.log('cmdCtr', cmdCtr);

  var keyData = '';
  const newKeyBytes = hexToBytes(newKey);
  if (keyNo == '00') {
    //if key 0 is to be changed
    //keyData = NewKey || KeyVer 17 byte
    // 0000000000000000000000000000
    // 0000000000000000000000000000
    keyData = padForEnc(newKey + keyVersion, 32); //32 byte
  } else {
    //if key 1 to 4 are to be changed
    //keyData = (NewKey XOR OldKey) || KeyVer || CRC32NK
    // crc32
    var WordArray = CryptoJS.lib.WordArray;

    const oldNewXorBytes = CryptoJS.ext.xor(
      new WordArray.init(hexToBytes(key)),
      new WordArray.init(newKeyBytes),
    ).words;
    const oldNewXor = bytesToHex(oldNewXorBytes);
    const crc32Reversed = crc.crcjam(newKeyBytes).toString(16).padStart(8, '0');
    const crc32 = bytesToHex(hexToBytes(crc32Reversed).reverse());
    keyData = padForEnc(oldNewXor + keyVersion + crc32, 32); //32 bytes
  }

  const encKeyData = Ntag424.encData(keyData, cmdCtr);
  const truncatedMac = Ntag424.calcMac(
    'C4' + cmdCtr + Ntag424.ti + keyNo + encKeyData,
  );

  const data = encKeyData + truncatedMac;
  const lc = (data.length / 2 + 1).toString(16);
  const changeKeyHex =
    '90C40000' + lc + keyNo + encKeyData + truncatedMac + '00';
  const changeKeyRes = await Ntag424.sendAPDUCommand(hexToBytes(changeKeyHex));

  const resCode = bytesToHex([changeKeyRes.sw1, changeKeyRes.sw2]);
  console.warn('changeKeyRes Result: ', resCode);
  if (resCode == '9100') {
    return Promise.resolve('Successful');
  } else {
    return Promise.reject(
      'Change Key Failed for key ' +
        parseInt(keyNo, 16) +
        ', code ' +
        resCode +
        ' ' +
        changeKeyErrorCodes[resCode],
    );
  }
};

/**
 * Get Card UID
 * CommMode Full
 *
 * @returns
 */
Ntag424.getCardUid = async () => {
  var cmdCtr = decToHexLsbFirst(Ntag424.cmdCtrDec++, 2);
  const commandMac = CryptoJS.CMAC(
    CryptoJS.enc.Hex.parse(Ntag424.sesAuthMacKey),
    CryptoJS.enc.Hex.parse('51' + cmdCtr + Ntag424.ti),
  );
  const commandMacHex = commandMac.toString();

  const truncatedMacBytes = hexToBytes(commandMacHex).filter(function (
    element,
    index,
    array,
  ) {
    return (index + 1) % 2 === 0;
  });
  const truncatedMac = bytesToHex(truncatedMacBytes);

  const getCardUidBytes = hexToBytes('9051000008' + truncatedMac + '00');
  const getCardUidRes = await Ntag424.sendAPDUCommand(getCardUidBytes);

  const responseAPDU = bytesToHex(getCardUidRes.response);
  const resCode = bytesToHex([getCardUidRes.sw1, getCardUidRes.sw2]);

  const resMacT = responseAPDU.slice(-16);
  cmdCtr = decToHexLsbFirst(Ntag424.cmdCtrDec, 2);

  const iv = ivEncryptionResponse(Ntag424.ti, cmdCtr, Ntag424.sesAuthEncKey);

  // console.log('test iv ', ivEncryption("2B4D963C014DC36F24F69A50A394F875"))
  const resDataEnc = responseAPDU.slice(0, -16);

  const resDataDec = AES.decrypt(
    {ciphertext: CryptoJS.enc.Hex.parse(resDataEnc)},
    CryptoJS.enc.Hex.parse(Ntag424.sesAuthEncKey),
    {
      padding: CryptoJS.pad.NoPadding,
      mode: CryptoJS.mode.CBC,
      iv: CryptoJS.enc.Hex.parse(iv),
      keySize: 128 / 8,
    },
  );
  const resData = CryptoJS.enc.Hex.stringify(resDataDec);
  const uid = resData.slice(0, 14);

  if (resCode == '9100') {
    return Promise.resolve(uid);
  } else {
    return Promise.reject(
      'Get Card UID Failed, code ' + resCode + ' ' + errorCodes[resCode],
    );
  }
};

/**
 * Write NDEF message
 * CommMode Plain
 *
 * @param {[]byte} ndefMessageByte ndef message in byte array (up to 248 byte)
 * @returns
 */
Ntag424.setNdefMessage = async ndefMessageByte => {
  try {
    await Ntag424.isoSelectFileApplication();

    const secondISO = await Ntag424.sendAPDUCommand(
      hexToBytes('00A4000002E10300'),
    );
    console.log(
      '2nd isoSelectRes: ',
      bytesToHex([secondISO.sw1, secondISO.sw2]),
    );

    const isoSelectFileBytes = hexToBytes('00A4000002E10400');
    const isoSelectRes = await Ntag424.sendAPDUCommand(isoSelectFileBytes);
    console.log(
      '3rd isoSelectRes: ',
      bytesToHex([isoSelectRes.sw1, isoSelectRes.sw2]),
    );
    const resultHex = bytesToHex([isoSelectRes.sw1, isoSelectRes.sw2]);
    if (resultHex == '9000') {
    } else {
      return Promise.reject(
        'ISO Select File Failed, code ' +
          resultHex +
          ' ' +
          errorCodes[resultHex],
      );
    }

    const ndefMessage = bytesToHex(ndefMessageByte);
    const ndefLength = ndefMessageByte.length.toString(16).padStart(4, '0');
    const lc = ndefMessageByte.length + 2;
    const lcHex = lc.toString(16).padStart(2, '0');
    //ndef message (up to 248 byte including secure messaging)
    const isoUpdateBinary = '00D60000' + lcHex + ndefLength + ndefMessage;
    console.log('isoUpdateBinaryHex', isoUpdateBinary);
    const isoUpdateBinaryRes = await Ntag424.sendAPDUCommand(
      hexToBytes(isoUpdateBinary),
    );
    const resCode = bytesToHex([
      isoUpdateBinaryRes.sw1,
      isoUpdateBinaryRes.sw2,
    ]);
    console.log('isoUpdateBinaryRes Res: ', resCode);
    if (resCode == '9000') {
      return Promise.resolve(resCode);
    } else {
      return Promise.reject(
        'Set NDEF Message Failed, code ' + resCode + ' ' + errorCodes[resCode],
      );
    }
  } catch (e) {
    return Promise.reject('setNdefMessage Failed: ' + e);
  }
};

/**
 * Read NDEF message
 * CommMode Plain
 *
 * @param {string} offset
 * @returns
 */
Ntag424.readData = async offset => {
  //read the entire StandardData file, starting from the position specified in the offset value.
  const length = '000000';

  const readDataHex = '90AD000007' + '02' + offset + length + '00';
  console.log('readData', readDataHex);
  const readDataRes = await Ntag424.sendAPDUCommand(hexToBytes(readDataHex));
  const resData = readDataRes.response;
  const resCode = bytesToHex([readDataRes.sw1, readDataRes.sw2]);
  console.warn('readData Res: ', resCode, resData);
  if (resCode == '9100') {
    return Promise.resolve(resData);
  } else {
    return Promise.reject(
      'Read Data Failed, code ' + resCode + ' ' + errorCodes[resCode],
    );
  }
};

/**
 * Read NDEF message
 * CommMode Plain
 *
 * @param {string} offset 1byte hex
 * @returns
 */
Ntag424.isoReadBinary = async offset => {
  await Ntag424.isoSelectFileApplication();

  const isoSelectFileBytes = hexToBytes('00A4000002E10400');
  const isoSelectRes = await Ntag424.sendAPDUCommand(isoSelectFileBytes);
  console.warn(
    'isoSelectRes: ',
    bytesToHex([isoSelectRes.sw1, isoSelectRes.sw2]),
  );
  const resultHex = bytesToHex([isoSelectRes.sw1, isoSelectRes.sw2]);
  if (resultHex == '9000') {
  } else {
    return Promise.reject(
      'ISO Select File Failed, code ' + resultHex + ' ' + errorCodes[resultHex],
    );
  }

  const cmdHex = '00B00000' + offset;
  const res = await Ntag424.sendAPDUCommand(hexToBytes(cmdHex));
  const resData = res.response;
  const resCode = bytesToHex([res.sw1, res.sw2]);
  console.warn('isoReadBinary Res: ', resCode, resData);
  if (resCode == '9000') {
    return Promise.resolve(resData);
  } else {
    return Promise.reject(
      'isoReadBinary Failed, code ' + resCode + ' ' + errorCodes[resCode],
    );
  }
};

/**
 * Get Key Version
 * CommMode Plain
 *
 * @param {string} keyNo key number in hex (1 byte)
 * @returns
 */
Ntag424.getKeyVersion = async keyNo => {
  var cmdHex = '9064000001' + keyNo + '00';
  console.log('getkeyversion hex', cmdHex);
  const res = await Ntag424.sendAPDUCommand(hexToBytes(cmdHex));
  const resData = res.response;
  const resCode = bytesToHex([res.sw1, res.sw2]);
  const keyVersion = bytesToHex(resData);
  if (resCode == '9100') {
    return Promise.resolve(keyVersion);
  } else {
    return Promise.reject(
      'Get Key Version Failed, code ' + resCode + ' ' + errorCodes[resCode],
    );
  }
};

/**
 * The GetVersion command returns manufacturing related data of NTAG 424 DNA (NT4H2421Gx).
 * No parameters are required for this command.
 * The version data is return over three frames.
 * Part1 returns the hardware-related information,
 * Part2 returns the software-related information and
 * Part3 and last frame returns the production-related information.
 *
 * CommMode Mac
 *
 * @param {string} keyNo key number in hex (1 byte)
 * @returns
 */
Ntag424.getVersion = async () => {
  //first part

  const firstHex = '9060000000';
  const firstRes = await Ntag424.sendAPDUCommand(hexToBytes(firstHex));
  const firstResData = bytesToHex(firstRes.response);

  const gerVersionErrorCodes = new Object();
  gerVersionErrorCodes['91ca'] =
    'COMMAND_ABORTED Chained command or multiple pass command ongoing.';
  gerVersionErrorCodes['911e'] =
    'INTEGRITY_ERROR Invalid secure messaging MAC (only).';
  gerVersionErrorCodes['917e'] = 'LENGTH_ERROR Command size not allowed.';
  gerVersionErrorCodes['91ee'] =
    'MEMORY_ERROR Failure when reading or writing to non-volatile memory.';

  var resCode = bytesToHex([firstRes.sw1, firstRes.sw2]);
  if (resCode == '91af') {
    //second part
    const secondHex = '90AF000000';
    const secondRes = await Ntag424.sendAPDUCommand(hexToBytes(secondHex));
    const secondResData = bytesToHex(secondRes.response);
    resCode = bytesToHex([secondRes.sw1, secondRes.sw2]);
    if (resCode == '91af') {
      //third part
      const thirdHex = '90AF000000';
      const thirdRes = await Ntag424.sendAPDUCommand(hexToBytes(thirdHex));
      const thirdResData = bytesToHex(thirdRes.response);
      resCode = bytesToHex([thirdRes.sw1, thirdRes.sw2]);
      if (resCode == '9100') {
        return Promise.resolve({
          VendorID: firstResData.slice(0, 2),
          HWType: firstResData.slice(2, 4),
          HWSubType: firstResData.slice(4, 6),
          HWMajorVersion: firstResData.slice(6, 8),
          HWMinorVersion: firstResData.slice(8, 10),
          HWStorageSize: firstResData.slice(10, 12),
          HWProtocol: firstResData.slice(12, 14),
          SWType: secondResData.slice(0, 2),
          SWSubType: secondResData.slice(4, 6),
          SWMajorVersion: secondResData.slice(6, 8),
          SWMinorVersion: secondResData.slice(8, 10),
          SWStorageSize: secondResData.slice(10, 12),
          SWProtocol: secondResData.slice(12, 14),
          UID: thirdResData.slice(0, 14),
          BatchNo: thirdResData.slice(14, 22),
          FabKey: thirdResData.slice(22, 24),
          CWProd: thirdResData.slice(24, 26),
          YearProd: thirdResData.slice(26, 28),
          FabKeyID: thirdResData.slice(28, 30),
        });
      }
    }
  }
  return Promise.reject(
    'Get Version Failed, code ' + resCode + ' ' + gerVersionErrorCodes[resCode],
  );
};

/**
 * SetConfiguration
 *
 * CommMode Full
 *
 * @param {string} option Configuration Option. (1 byte)
 * @param {string} data Data content depends on option values. (Up to 10 bytes)
 *
 * @returns
 */
Ntag424.setConfiguration = async (option, configData) => {
  const cmdHeader = '905c0000';
  const cmdData = configData;

  const cmdDataPadd = padForEnc(cmdData, 16);

  const cmdCtr = decToHexLsbFirst(Ntag424.cmdCtrDec++, 2);

  const encKeyData = Ntag424.encData(cmdDataPadd, cmdCtr);

  const commandData = '5c' + cmdCtr + Ntag424.ti + option + encKeyData;

  const truncatedMac = Ntag424.calcMac(commandData);

  const data = encKeyData + truncatedMac;
  const lc = (data.length / 2 + 1).toString(16);
  const apduHex = cmdHeader + lc + option + encKeyData + truncatedMac + '00';

  const res = await Ntag424.sendAPDUCommand(hexToBytes(apduHex));
  const resCode = bytesToHex([res.sw1, res.sw2]);
  console.warn('setConfiguration Result: ', resCode);
  if (resCode == '9100') {
    return Promise.resolve('Successful');
  } else {
    return Promise.reject(
      'SetConfiguration Failed, code ' +
        resCode +
        ' ' +
        changeFileSettingsErrorCodes[resCode],
    );
  }
};

/**
 * Enabling random uid. This is non-reversable
 *
 *
 * @returns Promise
 */
Ntag424.setPrivateUid = () => {
  return Ntag424.setConfiguration('00', '02');
};

/**
 * Test p and c values in ndef message
 *
 *
 * @param {string} pVal p value
 * @param {string} cVal c value
 * @param {string} uid uid of the card in hex
 * @param {string} piccKey key 1
 * @param {string} macKey key 2
 * @returns
 */
Ntag424.testPAndC = async (pVal, cVal, uid, piccKey, macKey) => {
  var result = {pTest: false, cTest: false};
  const decPiccData = AES.decrypt(
    {ciphertext: CryptoJS.enc.Hex.parse(pVal)},
    CryptoJS.enc.Hex.parse(piccKey),
    {
      padding: CryptoJS.pad.NoPadding,
      mode: CryptoJS.mode.CBC,
      iv: CryptoJS.enc.Hex.parse('00000000000000000000000000000000'),
      keySize: 128 / 8,
    },
  );
  const decryptedPiccData =
    CryptoJS.enc.Hex.stringify(decPiccData).toLowerCase();
  if (decryptedPiccData.startsWith('c7' + uid.toLowerCase()))
    result.pTest = true;

  const sdmReadCtr = decryptedPiccData.slice(16, 22);
  const sv2 = '3cc300010080' + uid + sdmReadCtr;
  const sesSdmFileReadMAC = CryptoJS.CMAC(
    CryptoJS.enc.Hex.parse(macKey),
    CryptoJS.enc.Hex.parse(sv2),
  );
  const sesSdmFileReadMACHex = sesSdmFileReadMAC.toString();
  const sdmMac = CryptoJS.CMAC(CryptoJS.enc.Hex.parse(sesSdmFileReadMACHex));
  const sdmMacHex = sdmMac.toString();

  const truncatedMacBytes = hexToBytes(sdmMacHex).filter(function (
    element,
    index,
    array,
  ) {
    return (index + 1) % 2 === 0;
  });
  const truncatedSdmMacHex = bytesToHex(truncatedMacBytes);
  if (truncatedSdmMacHex == cVal.toLowerCase()) result.cTest = true;
  return Promise.resolve(result);
};

export default Ntag424;