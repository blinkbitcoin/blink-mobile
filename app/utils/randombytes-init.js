// Initialize react-native-randombytes
import { NativeModules } from 'react-native';
const { RNRandomBytes } = NativeModules;

// Ensure RNRandomBytes is properly seeded
if (RNRandomBytes && typeof RNRandomBytes.seed === 'function') {
  RNRandomBytes.seed(32);
}

export default RNRandomBytes; 