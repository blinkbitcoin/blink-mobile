import { useApolloClient } from "@apollo/client"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { BUILD_VERSION } from "../app"
import { authTokenVar } from "../graphql/client-only-query"
import { NETWORK_STRING } from "../utils/network"
import KeyStoreWrapper from "../utils/storage/secureStorage"
import { TOKEN_KEY } from "../utils/use-token"

const useLogout = () => {
  const client = useApolloClient()

  const logout = async (): Promise<void> => {
    try {
      await client.clearStore()
      authTokenVar(null)
      // await AsyncStorage.clear()
      await AsyncStorage.multiRemove([NETWORK_STRING, TOKEN_KEY, BUILD_VERSION]) // use storage.ts wrapper
      await KeyStoreWrapper.removeIsBiometricsEnabled()
      await KeyStoreWrapper.removePin()
      await KeyStoreWrapper.removePinAttempts()
      await KeyStoreWrapper.removeIsSendLockEnabled()
    } catch (err) {
      console.log({ err }, `error resetting RootStore`)
    }
  }

  return {
    logout,
  }
}

export default useLogout
