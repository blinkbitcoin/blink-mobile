import { Platform } from "react-native"

import { legacyErase, legacyRead } from "@app/utils/storage/legacy-key-store"

const mockGet = jest.fn()
const mockRemove = jest.fn()
const mockSetResetOnAppUninstallTo = jest.fn()

jest.mock("react-native-secure-key-store", () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
    setResetOnAppUninstallTo: (...args: unknown[]) =>
      mockSetResetOnAppUninstallTo(...args),
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
})
