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

    it("records crashlytics when the primary mnemonic removal fails", async () => {
      mockRemove.mockRejectedValue(new Error("keystore unavailable"))

      await KeyStoreWrapper.deleteMnemonic()

      expect(mockRecordError).toHaveBeenCalledTimes(1)
      expect(mockRecordError.mock.calls[0][0].message).toContain("keystore unavailable")
    })

    it("records crashlytics for the network-key removal failure but still returns true", async () => {
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

describe("KeyStoreWrapper per-account mnemonic methods", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("getMnemonicForAccount", () => {
    it("reads from the namespaced key 'mnemonic:{accountId}'", async () => {
      mockGet.mockResolvedValue("alpha beta gamma")

      const result = await KeyStoreWrapper.getMnemonicForAccount("alice")

      expect(result).toBe("alpha beta gamma")
      expect(mockGet).toHaveBeenCalledWith("mnemonic:alice")
    })

    it("returns null on keychain error (silent failure)", async () => {
      mockGet.mockRejectedValue(new Error("keychain unavailable"))

      const result = await KeyStoreWrapper.getMnemonicForAccount("alice")

      expect(result).toBeNull()
    })

    it("isolates accounts by hitting a different key per id", async () => {
      mockGet.mockImplementation((key: string) =>
        key === "mnemonic:alice"
          ? Promise.resolve("alice words")
          : Promise.resolve("bob words"),
      )

      const alice = await KeyStoreWrapper.getMnemonicForAccount("alice")
      const bob = await KeyStoreWrapper.getMnemonicForAccount("bob")

      expect(alice).toBe("alice words")
      expect(bob).toBe("bob words")
      expect(mockGet).toHaveBeenNthCalledWith(1, "mnemonic:alice")
      expect(mockGet).toHaveBeenNthCalledWith(2, "mnemonic:bob")
    })
  })

  describe("setMnemonicForAccount", () => {
    it("writes to 'mnemonic:{accountId}' with WHEN_UNLOCKED_THIS_DEVICE_ONLY", async () => {
      mockSet.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.setMnemonicForAccount("alice", "alpha beta")

      expect(result).toBe(true)
      expect(mockSet).toHaveBeenCalledWith("mnemonic:alice", "alpha beta", {
        accessible: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
      })
    })

    it("returns false on storage error (silent failure surfaces as boolean)", async () => {
      mockSet.mockRejectedValue(new Error("keychain write-locked"))

      const result = await KeyStoreWrapper.setMnemonicForAccount("alice", "any words")

      expect(result).toBe(false)
    })

    it("isolates accounts by writing to a different key per id", async () => {
      mockSet.mockResolvedValue(undefined)

      await KeyStoreWrapper.setMnemonicForAccount("alice", "alice words")
      await KeyStoreWrapper.setMnemonicForAccount("bob", "bob words")

      expect(mockSet).toHaveBeenNthCalledWith(
        1,
        "mnemonic:alice",
        "alice words",
        expect.any(Object),
      )
      expect(mockSet).toHaveBeenNthCalledWith(
        2,
        "mnemonic:bob",
        "bob words",
        expect.any(Object),
      )
    })
  })

  describe("deleteMnemonicForAccount", () => {
    it("removes both 'mnemonic:{id}' and 'mnemonic_network:{id}', returns true", async () => {
      mockRemove.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.deleteMnemonicForAccount("alice")

      expect(result).toBe(true)
      expect(mockRemove).toHaveBeenCalledWith("mnemonic:alice")
      expect(mockRemove).toHaveBeenCalledWith("mnemonic_network:alice")
    })

    it("returns true even when the network-key removal fails (tolerated)", async () => {
      mockRemove
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("network key missing"))

      const result = await KeyStoreWrapper.deleteMnemonicForAccount("alice")

      expect(result).toBe(true)
    })

    it("returns false when the primary mnemonic removal fails", async () => {
      mockRemove.mockRejectedValueOnce(new Error("keystore unavailable"))

      const result = await KeyStoreWrapper.deleteMnemonicForAccount("alice")

      expect(result).toBe(false)
    })

    it("never touches the global 'mnemonic' / 'mnemonic_network' keys", async () => {
      mockRemove.mockResolvedValue(undefined)

      await KeyStoreWrapper.deleteMnemonicForAccount("alice")

      expect(mockRemove).toHaveBeenCalledWith("mnemonic:alice")
      expect(mockRemove).toHaveBeenCalledWith("mnemonic_network:alice")
      expect(mockRemove).not.toHaveBeenCalledWith("mnemonic")
      expect(mockRemove).not.toHaveBeenCalledWith("mnemonic_network")
      expect(mockRemove).not.toHaveBeenCalledWith("mnemonic:bob")
    })
  })

  describe("getMnemonicNetworkForAccount", () => {
    it("reads from 'mnemonic_network:{accountId}'", async () => {
      mockGet.mockResolvedValue("regtest")

      const result = await KeyStoreWrapper.getMnemonicNetworkForAccount("alice")

      expect(result).toBe("regtest")
      expect(mockGet).toHaveBeenCalledWith("mnemonic_network:alice")
    })

    it("returns null on keychain error (silent failure)", async () => {
      mockGet.mockRejectedValue(new Error("not found"))

      const result = await KeyStoreWrapper.getMnemonicNetworkForAccount("alice")

      expect(result).toBeNull()
    })
  })

  describe("setMnemonicNetworkForAccount", () => {
    it("writes to 'mnemonic_network:{accountId}' with WHEN_UNLOCKED_THIS_DEVICE_ONLY", async () => {
      mockSet.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.setMnemonicNetworkForAccount(
        "alice",
        "regtest",
      )

      expect(result).toBe(true)
      expect(mockSet).toHaveBeenCalledWith("mnemonic_network:alice", "regtest", {
        accessible: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
      })
    })

    it("returns false on storage error", async () => {
      mockSet.mockRejectedValue(new Error("storage error"))

      const result = await KeyStoreWrapper.setMnemonicNetworkForAccount(
        "alice",
        "mainnet",
      )

      expect(result).toBe(false)
    })
  })
})
