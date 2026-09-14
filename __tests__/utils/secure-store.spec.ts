import { BLINK_DOMAIN } from "@app/config/appinfo"
import {
  secureExists,
  secureRead,
  secureRemove,
  secureWrite,
  serverFor,
} from "@app/utils/storage/secure-store"

const mockGetInternetCredentials = jest.fn()
const mockHasInternetCredentials = jest.fn()
const mockSetInternetCredentials = jest.fn()
const mockResetInternetCredentials = jest.fn()

jest.mock("react-native-keychain", () => ({
  getInternetCredentials: (...args: unknown[]) => mockGetInternetCredentials(...args),
  hasInternetCredentials: (...args: unknown[]) => mockHasInternetCredentials(...args),
  setInternetCredentials: (...args: unknown[]) => mockSetInternetCredentials(...args),
  resetInternetCredentials: (...args: unknown[]) => mockResetInternetCredentials(...args),
  ACCESSIBLE: {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "AccessibleAfterFirstUnlockThisDeviceOnly",
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "AccessibleWhenUnlockedThisDeviceOnly",
  },
}))

const SLOT = "pinFailureState"
const SLOT_SERVER = "secure-store.blink.local/pinFailureState"
const ACCESSIBLE_AFTER_FIRST_UNLOCK =
  "AccessibleAfterFirstUnlockThisDeviceOnly" as Parameters<typeof secureWrite>[2]

/** Shape of a resolved `getInternetCredentials`, minus the fields we ignore. */
const credentials = (password: string) => ({
  server: SLOT_SERVER,
  username: SLOT,
  password,
  storage: "KeystoreAESGCM_NoAuth",
})

describe("secure-store", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("serverFor", () => {
    it("namespaces the slot name", () => {
      expect(serverFor(SLOT)).toBe(SLOT_SERVER)
    })

    it("gives every slot its own server", () => {
      expect(serverFor("PIN")).not.toBe(serverFor("pinAttempts"))
    })

    it("never collides with BLINK_DOMAIN, whose items a slot delete would erase", () => {
      const slots = ["PIN", "galoyAuthToken", "sessionProfiles", BLINK_DOMAIN]

      slots.forEach((slot) => {
        expect(serverFor(slot)).not.toBe(BLINK_DOMAIN)
      })
    })
  })

  describe("secureRead", () => {
    it("reports a stored value as found, queried by the slot's server", async () => {
      mockGetInternetCredentials.mockResolvedValue(credentials("stored-secret"))

      const read = await secureRead(SLOT)

      expect(read).toEqual({ status: "found", value: "stored-secret" })
      expect(mockGetInternetCredentials).toHaveBeenCalledWith(SLOT_SERVER)
    })

    it("reports false as absent, the only shape a missing item resolves to", async () => {
      mockGetInternetCredentials.mockResolvedValue(false)

      expect(await secureRead(SLOT)).toEqual({ status: "absent" })
    })

    it("reports an empty password as absent, not as an empty found value", async () => {
      mockGetInternetCredentials.mockResolvedValue(credentials(""))

      expect(await secureRead(SLOT)).toEqual({ status: "absent" })
    })

    it("reports a rejection as failed, never as absent", async () => {
      const err = new Error("E_KEYSTORE_ACCESS_ERROR")
      mockGetInternetCredentials.mockRejectedValue(err)

      expect(await secureRead(SLOT)).toEqual({ status: "failed", err })
    })
  })

  describe("secureExists", () => {
    it("probes by server without decrypting", async () => {
      mockHasInternetCredentials.mockResolvedValue(true)

      expect(await secureExists(SLOT)).toEqual({ status: "yes" })
      expect(mockHasInternetCredentials).toHaveBeenCalledWith({ server: SLOT_SERVER })
      expect(mockGetInternetCredentials).not.toHaveBeenCalled()
    })

    it("reports a missing item as no", async () => {
      mockHasInternetCredentials.mockResolvedValue(false)

      expect(await secureExists(SLOT)).toEqual({ status: "no" })
    })

    it("reports a rejection as failed, never as no", async () => {
      const err = new Error("E_CRYPTO_FAILED")
      mockHasInternetCredentials.mockRejectedValue(err)

      expect(await secureExists(SLOT)).toEqual({ status: "failed", err })
    })
  })

  describe("secureWrite", () => {
    it("puts the secret in password and the slot name in username", async () => {
      mockSetInternetCredentials.mockResolvedValue({ service: SLOT_SERVER })

      const written = await secureWrite(SLOT, "a-secret", ACCESSIBLE_AFTER_FIRST_UNLOCK)

      expect(written).toBe(true)
      expect(mockSetInternetCredentials).toHaveBeenCalledWith(
        SLOT_SERVER,
        SLOT,
        "a-secret",
        { accessible: ACCESSIBLE_AFTER_FIRST_UNLOCK },
      )
    })

    it("passes the caller's accessibility class through unchanged", async () => {
      mockSetInternetCredentials.mockResolvedValue({ service: SLOT_SERVER })
      const whenUnlocked = "AccessibleWhenUnlockedThisDeviceOnly" as Parameters<
        typeof secureWrite
      >[2]

      await secureWrite(SLOT, "a-secret", whenUnlocked)

      const [, , , options] = mockSetInternetCredentials.mock.calls[0]
      expect(options.accessible).toBe(whenUnlocked)
    })

    it("passes no accessControl: any biometry value flips the Android cipher", async () => {
      mockSetInternetCredentials.mockResolvedValue({ service: SLOT_SERVER })

      await secureWrite(SLOT, "a-secret", ACCESSIBLE_AFTER_FIRST_UNLOCK)

      const [, , , options] = mockSetInternetCredentials.mock.calls[0]
      expect(Object.keys(options)).toEqual(["accessible"])
      expect(options).not.toHaveProperty("accessControl")
    })

    it("passes no cloudSync: these secrets must not reach the iCloud Keychain", async () => {
      mockSetInternetCredentials.mockResolvedValue({ service: SLOT_SERVER })

      await secureWrite(SLOT, "a-secret", ACCESSIBLE_AFTER_FIRST_UNLOCK)

      const [, , , options] = mockSetInternetCredentials.mock.calls[0]
      expect(options).not.toHaveProperty("cloudSync")
    })

    it("refuses an empty value, which would read back as an unset slot", async () => {
      expect(await secureWrite(SLOT, "", ACCESSIBLE_AFTER_FIRST_UNLOCK)).toBe(false)
      expect(mockSetInternetCredentials).not.toHaveBeenCalled()
    })

    it("returns false when the library reports the write did not land", async () => {
      mockSetInternetCredentials.mockResolvedValue(false)

      expect(await secureWrite(SLOT, "a-secret", ACCESSIBLE_AFTER_FIRST_UNLOCK)).toBe(
        false,
      )
    })

    it("returns false on a rejection instead of throwing at the caller", async () => {
      mockSetInternetCredentials.mockRejectedValue(new Error("keystore write-locked"))

      expect(await secureWrite(SLOT, "a-secret", ACCESSIBLE_AFTER_FIRST_UNLOCK)).toBe(
        false,
      )
    })
  })

  describe("secureRemove", () => {
    it("deletes by the slot's server", async () => {
      mockResetInternetCredentials.mockResolvedValue(undefined)

      expect(await secureRemove(SLOT)).toBe(true)
      expect(mockResetInternetCredentials).toHaveBeenCalledWith({ server: SLOT_SERVER })
    })

    it("returns false on a rejection instead of throwing at the caller", async () => {
      mockResetInternetCredentials.mockRejectedValue(new Error("keystore unavailable"))

      expect(await secureRemove(SLOT)).toBe(false)
    })
  })
})
