import NfcManager from 'react-native-nfc-manager';

declare module '../../utils/Ntag424' {
  interface Ntag424Interface extends typeof NfcManager {
    ti: any;
    sesAuthEncKey: any;
    sesAuthMacKey: any;
    cmdCtrDec: any;
    util: {
      hexToBytes: (hex: string) => number[];
      bytesToHex: (bytes: number[]) => string;
    };
    
    // Add method declarations for all the methods used in setup-boltcard.tsx
    setNdefMessage: (bytes: any) => Promise<void>;
    AuthEv2First: (keyNo: string, key: string) => Promise<void>;
    setBoltCardFileSettings: (piccOffset: number, macOffset: number) => Promise<void>;
    changeKey: (keyNo: string, oldKey: string, newKey: string, keyVersion: string) => Promise<void>;
  }

  const Ntag424: Ntag424Interface;
  export default Ntag424;
} 