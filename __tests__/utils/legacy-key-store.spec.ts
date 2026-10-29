import { Platform } from "react-native"

import { legacyBlank, legacyErase, legacyRead } from "@app/utils/storage/legacy-key-store"

const mockGet = jest.fn()
const mockSet = jest.fn()
const mockRemove = jest.fn()
const mockSetResetOnAppUninstallTo = jest.fn()

jest.mock("react-native-secure-key-store", () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    set: (...args: unknown[]) => mockSet(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
    setResetOnAppUninstallTo: (...args: unknown[]) =>
      mockSetResetOnAppUninstallTo(...args),
  },
  ACCESSIBLE: {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "AccessibleAfterFirstUnlockThisDeviceOnly",
  },
}))

const setPlatform = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: os })
}

/** Both native modules reject a missing key with this code. */
const keyNotFound = () =>
  Object.assign(new Error("key does not present"), { code: "404" })

describe("legacy-key-store", () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    jest.clearAllMocks()
    setPlatform("ios")
  })

  afterAll(() => {
    setPlatform(originalPlatform)
  })

  describe("the uninstall guard", () => {
    it("disarms the reinstall wipe before reading, not after", async () => {
      const calls: string[] = []
      mockSetResetOnAppUninstallTo.mockImplementation(() => calls.push("guard"))
      mockGet.mockImplementation(() => {
        calls.push("get")
        return Promise.resolve("value")
      })

      await legacyRead("PIN")

      expect(calls).toEqual(["guard", "get"])
      expect(mockSetResetOnAppUninstallTo).toHaveBeenCalledWith(false)
    })

    it("is left off the erase, the one entry point the wipe never reaches", async () => {
      mockRemove.mockResolvedValue("cleared alias")

      await legacyErase("PIN")

      expect(mockSetResetOnAppUninstallTo).not.toHaveBeenCalled()
    })

    it("disarms the reinstall wipe before blanking, which reaches it too", async () => {
      const calls: string[] = []
      mockSetResetOnAppUninstallTo.mockImplementation(() => calls.push("guard"))
      mockSet.mockImplementation(() => {
        calls.push("set")
        return Promise.resolve("key stored successfully")
      })

      await legacyBlank("PIN")

      expect(calls).toEqual(["guard", "set"])
    })

    it("re-arms per call, since a skipped wipe leaves the trigger armed", async () => {
      mockGet.mockResolvedValue("value")

      await legacyRead("PIN")
      await legacyRead("PIN")

      expect(mockSetResetOnAppUninstallTo).toHaveBeenCalledTimes(2)
    })

    it("skips the guard on Android, whose module has no such method", async () => {
      setPlatform("android")
      mockGet.mockResolvedValue("value")

      const read = await legacyRead("PIN")

      expect(mockSetResetOnAppUninstallTo).not.toHaveBeenCalled()
      expect(read).toEqual({ status: "found", value: "value" })
    })

    it("still performs the read when the guard itself throws", async () => {
      mockSetResetOnAppUninstallTo.mockImplementation(() => {
        throw new Error("bridge method missing")
      })
      mockGet.mockResolvedValue("value")

      expect(await legacyRead("PIN")).toEqual({ status: "found", value: "value" })
    })
  })

  describe("legacyRead", () => {
    it("reads the key it is given and reports the value as found", async () => {
      mockGet.mockResolvedValue("1234")

      expect(await legacyRead("PIN")).toEqual({ status: "found", value: "1234" })
      expect(mockGet).toHaveBeenCalledWith("PIN")
    })

    it("reports an empty stored value as absent", async () => {
      mockGet.mockResolvedValue("")

      expect(await legacyRead("PIN")).toEqual({ status: "absent" })
    })

    it("reports a non-string resolution as absent", async () => {
      mockGet.mockResolvedValue(null)

      expect(await legacyRead("PIN")).toEqual({ status: "absent" })
    })

    it("reports the missing-key code as absent", async () => {
      mockGet.mockRejectedValue(keyNotFound())

      expect(await legacyRead("PIN")).toEqual({ status: "absent" })
    })

    it("reports the missing-key code as absent when it arrives as a number", async () => {
      mockGet.mockRejectedValue({ code: 404 })

      expect(await legacyRead("PIN")).toEqual({ status: "absent" })
    })

    it("reports any other code as failed, never as absent", async () => {
      const err = Object.assign(new Error("decrypt failed"), { code: "1" })
      mockGet.mockRejectedValue(err)

      expect(await legacyRead("PIN")).toEqual({ status: "failed", err })
    })

    it("reports an error carrying no code as failed", async () => {
      const err = new Error("bridge unavailable")
      mockGet.mockRejectedValue(err)

      expect(await legacyRead("PIN")).toEqual({ status: "failed", err })
    })

    it("reports a non-object rejection as failed", async () => {
      mockGet.mockRejectedValue("404")

      expect(await legacyRead("PIN")).toEqual({ status: "failed", err: "404" })
    })

    it("reports a null rejection as failed", async () => {
      mockGet.mockRejectedValue(null)

      expect(await legacyRead("PIN")).toEqual({ status: "failed", err: null })
    })
  })

  describe("legacyErase", () => {
    it("removes the key it is given", async () => {
      mockRemove.mockResolvedValue("cleared alias")

      expect(await legacyErase("PIN")).toBe(true)
      expect(mockRemove).toHaveBeenCalledWith("PIN")
    })

    it("returns false on a rejection instead of throwing at the caller", async () => {
      mockRemove.mockRejectedValue(new Error("keystore unavailable"))

      expect(await legacyErase("PIN")).toBe(false)
    })
  })

  describe("legacyBlank", () => {
    it("overwrites the key with an empty value, which every read reports as absent", async () => {
      mockSet.mockResolvedValue("key updated successfully")

      expect(await legacyBlank("PIN")).toBe(true)
      expect(mockSet).toHaveBeenCalledWith("PIN", "", expect.anything())
    })

    it("always passes the options the iOS module takes as a fixed argument", async () => {
      // Left out, the native call crashes the app instead of rejecting.
      mockSet.mockResolvedValue("key stored successfully")

      await legacyBlank("PIN")

      expect(mockSet).toHaveBeenCalledWith("PIN", "", {
        accessible: "AccessibleAfterFirstUnlockThisDeviceOnly",
      })
    })

    it("returns false on a rejection instead of throwing at the caller", async () => {
      mockSet.mockRejectedValue(
        Object.assign(new Error("error saving key"), { code: "9" }),
      )

      expect(await legacyBlank("PIN")).toBe(false)
    })
  })

  describe("a write the Android module refused", () => {
    /** The patched module rejects a commit that missed the disk with a bare message, which
     *  React Native gives this code. Its in-memory map keeps the edit either way. */
    const refusedCommit = () =>
      Object.assign(new Error('{"code":6,"api-level":35,"message":did not reach disk}'), {
        code: "EUNSPECIFIED",
      })

    /** Each case starts the way a launch does, with memory loaded from the file. A write the
     *  module acknowledges is what tells the store so. */
    beforeEach(async () => {
      setPlatform("android")
      mockRemove.mockResolvedValue("cleared alias")
      await legacyErase("launch")
      jest.clearAllMocks()
    })

    it("reads a key whose erase was refused as failed, not as the absence memory reports", async () => {
      mockRemove.mockRejectedValue(refusedCommit())
      mockGet.mockRejectedValue(keyNotFound())

      await legacyErase("sessionProfiles")
      const read = await legacyRead("sessionProfiles")

      expect(read.status).toBe("failed")
      expect(mockGet).not.toHaveBeenCalled()
    })

    it("reads a key whose blank was refused as failed, not as the blank memory holds", async () => {
      mockSet.mockRejectedValue(refusedCommit())
      mockGet.mockResolvedValue("")

      await legacyBlank("sessionProfiles")

      expect((await legacyRead("sessionProfiles")).status).toBe("failed")
    })

    it("still reads the keys no refused write touched", async () => {
      mockRemove.mockRejectedValue(refusedCommit())
      mockGet.mockResolvedValue("1234")

      await legacyErase("sessionProfiles")

      expect(await legacyRead("PIN")).toEqual({ status: "found", value: "1234" })
    })

    it("reads every key from the module again once a later write lands, since that write saves the whole file", async () => {
      mockRemove.mockRejectedValue(refusedCommit())
      await legacyErase("sessionProfiles")
      await legacyErase("token")
      mockSet.mockResolvedValue("stored ciphertext in app storage")
      mockGet.mockRejectedValue(keyNotFound())

      await legacyBlank("PIN")

      expect(await legacyRead("sessionProfiles")).toEqual({ status: "absent" })
      expect(await legacyRead("token")).toEqual({ status: "absent" })
    })

    it("leaves iOS reads to the keychain, which a refused write does not change", async () => {
      setPlatform("ios")
      mockRemove.mockRejectedValue(
        Object.assign(new Error("could not delete key"), { code: "6" }),
      )
      mockGet.mockResolvedValue("saved")

      await legacyErase("sessionProfiles")

      expect(await legacyRead("sessionProfiles")).toEqual({
        status: "found",
        value: "saved",
      })
    })
  })
})
