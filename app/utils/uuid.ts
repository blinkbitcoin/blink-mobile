import { generateSecureRandom } from "react-native-securerandom"
import { v4 as uuidv4 } from "uuid"

/**
 * A v4 UUID backed by the platform's CSPRNG.
 *
 * Never call `uuidv4()` bare: under Metro it resolves to uuid's browser build,
 * whose RNG is `crypto.getRandomValues()`, and React Native ships no global
 * crypto — the call throws. The randomness comes from react-native-securerandom
 * instead, which is async, hence the promise.
 */
export const generateSecureRandomUUID = async (): Promise<string> => {
  const randomBytes = await generateSecureRandom(16)
  return uuidv4({ random: randomBytes })
}
