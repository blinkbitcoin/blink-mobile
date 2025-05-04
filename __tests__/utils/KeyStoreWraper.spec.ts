import RNSecureKeyStore from "react-native-secure-key-store"

import { defaultSecureStorageState } from "@app/store/persistent-state/state-migrations"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

const options = { accessible: "AccessibleAlwaysThisDeviceOnly" }

describe("KeyStoreWrapper", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("getSecureStorageState", () => {
    let spy: jest.SpyInstance

    beforeEach(() => {
      spy = jest.spyOn(RNSecureKeyStore, "get")
    })

    afterEach(() => {
      spy.mockRestore()
    })

    it("should use the right key", async () => {
      await KeyStoreWrapper.getSecureStorageState()
      expect(spy).toHaveBeenCalledWith("secureState")
    })

    it("should parse and return secure stored state on success", async () => {
      const secureStorageState = { galoyAuthToken: "token" }
      spy.mockResolvedValue(JSON.stringify(secureStorageState))

      const state = await KeyStoreWrapper.getSecureStorageState()
      expect(spy).toHaveBeenCalledWith("secureState")
      expect(state).toEqual(secureStorageState)
    })

    it("should return default secure storage state on error", async () => {
      spy.mockRejectedValue(new Error("Simulated error"))

      const state = await KeyStoreWrapper.getSecureStorageState()
      expect(spy).toHaveBeenCalledWith("secureState")
      expect(state).toEqual(defaultSecureStorageState)
    })
  })

  describe("setSecureStorageState", () => {
    let spy: jest.SpyInstance

    beforeEach(() => {
      spy = jest.spyOn(RNSecureKeyStore, "set")
    })

    afterEach(() => {
      spy.mockRestore()
    })

    it("should use the right arguments", async () => {
      const secureStorageState = { galoyAuthToken: "token" }
      await KeyStoreWrapper.setSecureStorageState(secureStorageState)
      expect(spy).toHaveBeenCalledWith(
        "secureState",
        JSON.stringify(secureStorageState),
        options,
      )
    })

    it("should return true on success", async () => {
      const secureStorageState = { galoyAuthToken: "token" }

      const response = await KeyStoreWrapper.setSecureStorageState(secureStorageState)
      expect(response).toBe(true)
    })

    it("should return false on error", async () => {
      const secureStorageState = { galoyAuthToken: "token" }
      spy.mockRejectedValue(new Error("Simulated error"))

      const response = await KeyStoreWrapper.setSecureStorageState(secureStorageState)
      expect(response).toBe(false)
      spy.mockRestore()
    })
  })

  describe("removeSecureStorageState", () => {
    let spy: jest.SpyInstance

    beforeEach(() => {
      spy = jest.spyOn(RNSecureKeyStore, "remove")
    })

    afterEach(() => {
      spy.mockRestore()
    })

    it("should use the right key", async () => {
      await KeyStoreWrapper.removeSecureStorageState()
      expect(spy).toHaveBeenCalledWith("secureState")
    })

    it("should return true on success", async () => {
      const response = await KeyStoreWrapper.removeSecureStorageState()
      expect(response).toBe(true)
    })

    it("should return false on error", async () => {
      spy.mockRejectedValue(new Error("Simulated error"))

      const response = await KeyStoreWrapper.removeSecureStorageState()
      expect(response).toBe(false)
      spy.mockRestore()
    })
  })
})
