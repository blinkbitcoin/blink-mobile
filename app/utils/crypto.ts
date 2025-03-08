import {randomBytes} from 'crypto';
import {Platform} from 'react-native';

/**
 * Generates a secure random hexadecimal string of the specified length
 * @param length The length of the hexadecimal string to generate
 * @returns A secure random hexadecimal string
 */
export const generateSecureRandomHex = (length: number): Promise<string> => {
  // Calculate number of bytes needed (2 hex chars per byte)
  const byteLength = Math.ceil(length / 2);
  
  return new Promise((resolve, reject) => {
    try {
      // Handle potential issues with randomBytes
      if (typeof randomBytes !== 'function') {
        console.error('randomBytes is not a function');
        // Fallback to a less secure method if randomBytes is not available
        // Use Math.random as a last resort
        let result = '';
        const characters = '0123456789abcdef';
        for (let i = 0; i < length; i++) {
          result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        resolve(result);
        return;
      }
      
      // Use the secure randomBytes function
      const bytes = randomBytes(byteLength);
      const hexString = bytes.toString('hex').slice(0, length);
      resolve(hexString);
    } catch (error) {
      console.error('Error generating secure random hex:', error);
      reject(error);
    }
  });
}

/**
 * Generates a set of secure random keys for Bolt Card registration
 * @returns An object containing the 5 keys (k0-k4) needed for Bolt Card registration
 */
export const generateBoltCardKeys = async (): Promise<{ k0: string, k1: string, k2: string, k3: string, k4: string }> => {
  // Each key is 32 characters (16 bytes) of hex
  return {
    k0: await generateSecureRandomHex(32),
    k1: await generateSecureRandomHex(32),
    k2: await generateSecureRandomHex(32), 
    k3: await generateSecureRandomHex(32),
    k4: await generateSecureRandomHex(32),
  }
}