import KeyStoreWrapper from "@app/utils/storage/secureStorage"

const mockGet = jest.fn()
const mockSet = jest.fn()
const mockRemove = jest.fn()
const mockRecordError = jest.fn()

jest.mock("react-native-secure-key-store", () => ({
  __esModule: true,
  default: {
    get: (...args: string[]) => mockGet(...args),
    set: (...args: string[]) => mockSet(...args),
    remove: (...args: string[]) => mockRemove(...args),
  },
  ACCESSIBLE: {
    ALWAYS_THIS_DEVICE_ONLY: "ALWAYS_THIS_DEVICE_ONLY",
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
  },
}))

jest.mock("@react-native-firebase/crashlytics", () => ({
  __esModule: true,
  default: () => ({ recordError: mockRecordError, log: jest.fn() }),
}))

describe("KeyStoreWrapper mnemonic methods", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("hasMnemonic", () => {
    it("returns true when mnemonic exists", async () => {
      mockGet.mockResolvedValue("word1 word2 word3")

      const result = await KeyStoreWrapper.hasMnemonic()

      expect(result).toBe(true)
      expect(mockGet).toHaveBeenCalledWith("mnemonic")
    })

    it("returns false when mnemonic does not exist", async () => {
      mockGet.mockRejectedValue(new Error("not found"))

      const result = await KeyStoreWrapper.hasMnemonic()

      expect(result).toBe(false)
    })
  })

  describe("getMnemonic", () => {
    it("returns mnemonic string when exists", async () => {
      mockGet.mockResolvedValue(
        "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12",
      )

      const result = await KeyStoreWrapper.getMnemonic()

      expect(result).toBe(
        "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12",
      )
    })

    it("returns null on keychain error", async () => {
      mockGet.mockRejectedValue(new Error("keychain unavailable"))

      const result = await KeyStoreWrapper.getMnemonic()

      expect(result).toBeNull()
    })

    it("returns null when key not found", async () => {
      mockGet.mockRejectedValue(new Error("not found"))

      const result = await KeyStoreWrapper.getMnemonic()

      expect(result).toBeNull()
    })
  })

  describe("setMnemonic", () => {
    it("stores mnemonic with WHEN_UNLOCKED_THIS_DEVICE_ONLY accessibility", async () => {
      mockSet.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.setMnemonic("test mnemonic")

      expect(result).toBe(true)
      expect(mockSet).toHaveBeenCalledWith("mnemonic", "test mnemonic", {
        accessible: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
      })
    })

    it("returns false on failure", async () => {
      mockSet.mockRejectedValue(new Error("storage error"))

      const result = await KeyStoreWrapper.setMnemonic("test mnemonic")

      expect(result).toBe(false)
    })
  })

  describe("deleteMnemonic", () => {
    it("removes mnemonic and network, returns true", async () => {
      mockRemove.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.deleteMnemonic()

      expect(result).toBe(true)
      expect(mockRemove).toHaveBeenCalledWith("mnemonic")
      expect(mockRemove).toHaveBeenCalledWith("mnemonic_network")
    })

    it("returns false on failure", async () => {
      mockRemove.mockRejectedValue(new Error("remove error"))

      const result = await KeyStoreWrapper.deleteMnemonic()

      expect(result).toBe(false)
    })

    it("returns false when key does not exist", async () => {
      mockRemove.mockRejectedValue(new Error("key not found"))

      const result = await KeyStoreWrapper.deleteMnemonic()

      expect(result).toBe(false)
    })

    it("records crashlytics when the primary mnemonic removal fails (Important #5)", async () => {
      mockRemove.mockRejectedValue(new Error("keystore unavailable"))

      await KeyStoreWrapper.deleteMnemonic()

      expect(mockRecordError).toHaveBeenCalledTimes(1)
      expect(mockRecordError.mock.calls[0][0].message).toContain("keystore unavailable")
    })

    it("records crashlytics for the network-key removal failure but still returns true (Important #5)", async () => {
      mockRemove
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("network key write-locked"))

      const result = await KeyStoreWrapper.deleteMnemonic()

      expect(result).toBe(true)
      expect(mockRecordError).toHaveBeenCalledTimes(1)
      expect(mockRecordError.mock.calls[0][0].message).toContain(
        "network key write-locked",
      )
    })

    it("does not record crashlytics when both removals succeed", async () => {
      mockRemove.mockResolvedValue(undefined)

      await KeyStoreWrapper.deleteMnemonic()

      expect(mockRecordError).not.toHaveBeenCalled()
    })
  })

  describe("getMnemonicNetwork", () => {
    it("returns stored network string", async () => {
      mockGet.mockResolvedValue("regtest")

      const result = await KeyStoreWrapper.getMnemonicNetwork()

      expect(result).toBe("regtest")
      expect(mockGet).toHaveBeenCalledWith("mnemonic_network")
    })

    it("returns null when not found", async () => {
      mockGet.mockRejectedValue(new Error("not found"))

      const result = await KeyStoreWrapper.getMnemonicNetwork()

      expect(result).toBeNull()
    })
  })

  describe("setMnemonicNetwork", () => {
    it("stores network with WHEN_UNLOCKED_THIS_DEVICE_ONLY", async () => {
      mockSet.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.setMnemonicNetwork("regtest")

      expect(result).toBe(true)
      expect(mockSet).toHaveBeenCalledWith("mnemonic_network", "regtest", {
        accessible: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
      })
    })

    it("returns false on failure", async () => {
      mockSet.mockRejectedValue(new Error("storage error"))

      const result = await KeyStoreWrapper.setMnemonicNetwork("mainnet")

      expect(result).toBe(false)
    })
  })
})
