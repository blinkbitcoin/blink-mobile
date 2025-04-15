import RNSecureKeyStore, { ACCESSIBLE } from "react-native-secure-key-store"

export default class KeyStoreWrapper {
  private static readonly IS_BIOMETRICS_ENABLED = "isBiometricsEnabled"
  private static readonly PIN = "PIN"
  private static readonly PIN_ATTEMPTS = "pinAttempts"
  private static readonly TOKENS = "TOKENS"

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

  public static async saveSessionToken(token: string): Promise<boolean> {
    try {
      if (!token || token.trim() === "") {
        return false
      }
      const oldTokens = await this.getSessionTokens()
      const combinedToken = [...oldTokens, token]

      await RNSecureKeyStore.set(KeyStoreWrapper.TOKENS, JSON.stringify(combinedToken), {
        accessible: ACCESSIBLE.ALWAYS_THIS_DEVICE_ONLY,
      })
      return true
    } catch {
      return false
    }
  }

  public static async getSessionTokens(): Promise<string[]> {
    try {
      const tokens = await RNSecureKeyStore.get(KeyStoreWrapper.TOKENS)
      if (tokens) return JSON.parse(tokens)
      return []
    } catch {
      return []
    }
  }

  public static async removeTokenFromSession(token: string): Promise<boolean> {
    try {
      const updatedToken = (await this.getSessionTokens()).filter((t) => t !== token)
      await RNSecureKeyStore.set(
        KeyStoreWrapper.TOKENS,
        JSON.stringify([...updatedToken]),
        {
          accessible: ACCESSIBLE.ALWAYS_THIS_DEVICE_ONLY,
        },
      )
      return true
    } catch {
      return false
    }
  }

  public static async removeAllSessionTokens(): Promise<boolean> {
    try {
      await RNSecureKeyStore.remove(KeyStoreWrapper.TOKENS)
      return true
    } catch {
      return false
    }
  }
}
