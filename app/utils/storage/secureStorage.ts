import RNSecureKeyStore, { ACCESSIBLE } from "react-native-secure-key-store"

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

  private static mnemonicKeyFor(accountId: string): string {
    return `${KeyStoreWrapper.MNEMONIC}:${accountId}`
  }

  private static mnemonicNetworkKeyFor(accountId: string): string {
    return `${KeyStoreWrapper.MNEMONIC_NETWORK}:${accountId}`
  }

  public static async getMnemonicForAccount(accountId: string): Promise<string | null> {
    try {
      return await RNSecureKeyStore.get(KeyStoreWrapper.mnemonicKeyFor(accountId))
    } catch {
      return null
    }
  }

  public static async setMnemonicForAccount(
    accountId: string,
    mnemonic: string,
  ): Promise<boolean> {
    try {
      await RNSecureKeyStore.set(KeyStoreWrapper.mnemonicKeyFor(accountId), mnemonic, {
        accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      })
      return true
    } catch {
      return false
    }
  }

  public static async deleteMnemonicForAccount(accountId: string): Promise<boolean> {
    try {
      await RNSecureKeyStore.remove(KeyStoreWrapper.mnemonicKeyFor(accountId))
      await RNSecureKeyStore.remove(
        KeyStoreWrapper.mnemonicNetworkKeyFor(accountId),
      ).catch(() => {})
      return true
    } catch {
      return false
    }
  }

  public static async getMnemonicNetworkForAccount(
    accountId: string,
  ): Promise<string | null> {
    try {
      return await RNSecureKeyStore.get(KeyStoreWrapper.mnemonicNetworkKeyFor(accountId))
    } catch {
      return null
    }
  }

  public static async setMnemonicNetworkForAccount(
    accountId: string,
    network: string,
  ): Promise<boolean> {
    try {
      await RNSecureKeyStore.set(
        KeyStoreWrapper.mnemonicNetworkKeyFor(accountId),
        network,
        {
          accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        },
      )
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
