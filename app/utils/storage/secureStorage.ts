import crashlytics from "@react-native-firebase/crashlytics"
import RNSecureKeyStore, { ACCESSIBLE } from "react-native-secure-key-store"

const safeRemoveKey = async (key: string, label: string): Promise<boolean> => {
  try {
    await RNSecureKeyStore.remove(key)
    return true
  } catch (err) {
    crashlytics().recordError(err instanceof Error ? err : new Error(`${label}: ${err}`))
    return false
  }
}

export default class KeyStoreWrapper {
  private static readonly IS_BIOMETRICS_ENABLED = "isBiometricsEnabled"
  private static readonly PIN = "PIN"
  private static readonly PIN_ATTEMPTS = "pinAttempts"
  private static readonly SESSION_PROFILES = "sessionProfiles"
  private static readonly MNEMONIC = "mnemonic"
  private static readonly MNEMONIC_NETWORK = "mnemonic_network"

  public static async getIsBiometricsEnabled(): Promise<boolean> {
    try {
      await RNSecureKeyStore.get(KeyStoreWrapper.IS_BIOMETRICS_ENABLED)
      return true
    } catch {
      return false
    }
  }

  public static async setIsBiometricsEnabled(): Promise<boolean> {
    try {
      await RNSecureKeyStore.set(KeyStoreWrapper.IS_BIOMETRICS_ENABLED, "1", {
        accessible: ACCESSIBLE.ALWAYS_THIS_DEVICE_ONLY,
      })
      return true
    } catch {
      return false
    }
  }

  public static async removeIsBiometricsEnabled(): Promise<boolean> {
    try {
      await RNSecureKeyStore.remove(KeyStoreWrapper.IS_BIOMETRICS_ENABLED)
      return true
    } catch {
      return false
    }
  }

  public static async getIsPinEnabled(): Promise<boolean> {
    try {
      await RNSecureKeyStore.get(KeyStoreWrapper.PIN)
      return true
    } catch {
      return false
    }
  }

  public static async getPinOrEmptyString(): Promise<string> {
    try {
      return await RNSecureKeyStore.get(KeyStoreWrapper.PIN)
    } catch {
      return ""
    }
  }

  public static async setPin(pin: string): Promise<boolean> {
    try {
      await RNSecureKeyStore.set(KeyStoreWrapper.PIN, pin, {
        accessible: ACCESSIBLE.ALWAYS_THIS_DEVICE_ONLY,
      })
      return true
    } catch {
      return false
    }
  }

  public static async removePin(): Promise<boolean> {
    try {
      await RNSecureKeyStore.remove(KeyStoreWrapper.PIN)
      return true
    } catch {
      return false
    }
  }

  public static async getPinAttemptsOrZero(): Promise<number> {
    try {
      return Number(await RNSecureKeyStore.get(KeyStoreWrapper.PIN_ATTEMPTS))
    } catch {
      return 0
    }
  }

  public static async setPinAttempts(pinAttempts: string): Promise<boolean> {
    try {
      await RNSecureKeyStore.set(KeyStoreWrapper.PIN_ATTEMPTS, pinAttempts, {
        accessible: ACCESSIBLE.ALWAYS_THIS_DEVICE_ONLY,
      })
      return true
    } catch {
      return false
    }
  }

  public static async resetPinAttempts(): Promise<boolean> {
    return KeyStoreWrapper.setPinAttempts("0")
  }

  public static async removePinAttempts(): Promise<boolean> {
    try {
      await RNSecureKeyStore.remove(KeyStoreWrapper.PIN_ATTEMPTS)
      return true
    } catch {
      return false
    }
  }

  public static async saveSessionProfiles(profiles: ProfileProps[]): Promise<boolean> {
    try {
      const serialized = JSON.stringify(profiles)
      await RNSecureKeyStore.set(KeyStoreWrapper.SESSION_PROFILES, serialized, {
        accessible: ACCESSIBLE.ALWAYS_THIS_DEVICE_ONLY,
      })
      return true
    } catch (err) {
      return false
    }
  }

  public static async getSessionProfiles(): Promise<ProfileProps[]> {
    try {
      const data = await RNSecureKeyStore.get(KeyStoreWrapper.SESSION_PROFILES)
      const parsed = data ? JSON.parse(data) : []
      return parsed
    } catch (err) {
      return []
    }
  }

  public static async removeSessionProfiles(): Promise<boolean> {
    try {
      await RNSecureKeyStore.remove(KeyStoreWrapper.SESSION_PROFILES)
      return true
    } catch (err) {
      return false
    }
  }

  public static async hasMnemonic(): Promise<boolean> {
    try {
      await RNSecureKeyStore.get(KeyStoreWrapper.MNEMONIC)
      return true
    } catch {
      return false
    }
  }

  public static async getMnemonic(): Promise<string | null> {
    try {
      return await RNSecureKeyStore.get(KeyStoreWrapper.MNEMONIC)
    } catch {
      return null
    }
  }

  public static async setMnemonic(mnemonic: string): Promise<boolean> {
    try {
      await RNSecureKeyStore.set(KeyStoreWrapper.MNEMONIC, mnemonic, {
        accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      })
      return true
    } catch {
      return false
    }
  }

  public static async deleteMnemonic(): Promise<boolean> {
    const primaryOk = await safeRemoveKey(
      KeyStoreWrapper.MNEMONIC,
      "Failed to delete MNEMONIC key",
    )
    if (!primaryOk) return false
    await safeRemoveKey(
      KeyStoreWrapper.MNEMONIC_NETWORK,
      "Failed to delete MNEMONIC_NETWORK key",
    )
    return true
  }

  public static async getMnemonicNetwork(): Promise<string | null> {
    try {
      return await RNSecureKeyStore.get(KeyStoreWrapper.MNEMONIC_NETWORK)
    } catch {
      return null
    }
  }

  public static async setMnemonicNetwork(network: string): Promise<boolean> {
    try {
      await RNSecureKeyStore.set(KeyStoreWrapper.MNEMONIC_NETWORK, network, {
        accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      })
      return true
    } catch {
      return false
    }
  }

  public static async removeSessionProfileByToken(token: string): Promise<boolean> {
    try {
      const profiles = await KeyStoreWrapper.getSessionProfiles()
      const updatedProfiles = profiles.filter((profile) => profile.token !== token)
      return await KeyStoreWrapper.saveSessionProfiles(updatedProfiles)
    } catch (err) {
      return false
    }
  }
}
