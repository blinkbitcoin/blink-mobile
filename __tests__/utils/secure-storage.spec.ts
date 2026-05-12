import KeyStoreWrapper from "@app/utils/storage/secureStorage"

const mockGet = jest.fn()
const mockSet = jest.fn()
const mockRemove = jest.fn()

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

describe("KeyStoreWrapper biometrics methods", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("getIsBiometricsEnabled", () => {
    it("returns true when the flag exists in the keystore", async () => {
      mockGet.mockResolvedValue("1")

      const result = await KeyStoreWrapper.getIsBiometricsEnabled()

      expect(result).toBe(true)
      expect(mockGet).toHaveBeenCalledWith("isBiometricsEnabled")
    })

    it("returns false when the flag is missing", async () => {
      mockGet.mockRejectedValue(new Error("not found"))

      const result = await KeyStoreWrapper.getIsBiometricsEnabled()

      expect(result).toBe(false)
    })
  })

  describe("setIsBiometricsEnabled", () => {
    it("writes '1' with ALWAYS_THIS_DEVICE_ONLY accessibility", async () => {
      mockSet.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.setIsBiometricsEnabled()

      expect(result).toBe(true)
      expect(mockSet).toHaveBeenCalledWith("isBiometricsEnabled", "1", {
        accessible: "ALWAYS_THIS_DEVICE_ONLY",
      })
    })

    it("returns false on storage error", async () => {
      mockSet.mockRejectedValue(new Error("write locked"))

      const result = await KeyStoreWrapper.setIsBiometricsEnabled()

      expect(result).toBe(false)
    })
  })

  describe("removeIsBiometricsEnabled", () => {
    it("removes the flag and returns true", async () => {
      mockRemove.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.removeIsBiometricsEnabled()

      expect(result).toBe(true)
      expect(mockRemove).toHaveBeenCalledWith("isBiometricsEnabled")
    })

    it("returns false when the keystore rejects", async () => {
      mockRemove.mockRejectedValue(new Error("not found"))

      const result = await KeyStoreWrapper.removeIsBiometricsEnabled()

      expect(result).toBe(false)
    })
  })
})

describe("KeyStoreWrapper PIN methods", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("getIsPinEnabled", () => {
    it("returns true when the PIN exists", async () => {
      mockGet.mockResolvedValue("1234")

      const result = await KeyStoreWrapper.getIsPinEnabled()

      expect(result).toBe(true)
      expect(mockGet).toHaveBeenCalledWith("PIN")
    })

    it("returns false when the PIN does not exist", async () => {
      mockGet.mockRejectedValue(new Error("not found"))

      const result = await KeyStoreWrapper.getIsPinEnabled()

      expect(result).toBe(false)
    })
  })

  describe("getPinOrEmptyString", () => {
    it("returns the stored PIN", async () => {
      mockGet.mockResolvedValue("1234")

      const result = await KeyStoreWrapper.getPinOrEmptyString()

      expect(result).toBe("1234")
    })

    it("returns empty string when the PIN is missing", async () => {
      mockGet.mockRejectedValue(new Error("not found"))

      const result = await KeyStoreWrapper.getPinOrEmptyString()

      expect(result).toBe("")
    })
  })

  describe("setPin", () => {
    it("writes the PIN with ALWAYS_THIS_DEVICE_ONLY accessibility", async () => {
      mockSet.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.setPin("1234")

      expect(result).toBe(true)
      expect(mockSet).toHaveBeenCalledWith("PIN", "1234", {
        accessible: "ALWAYS_THIS_DEVICE_ONLY",
      })
    })

    it("returns false on storage error", async () => {
      mockSet.mockRejectedValue(new Error("write locked"))

      const result = await KeyStoreWrapper.setPin("1234")

      expect(result).toBe(false)
    })
  })

  describe("removePin", () => {
    it("removes the PIN and returns true", async () => {
      mockRemove.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.removePin()

      expect(result).toBe(true)
      expect(mockRemove).toHaveBeenCalledWith("PIN")
    })

    it("returns false when the keystore rejects", async () => {
      mockRemove.mockRejectedValue(new Error("not found"))

      const result = await KeyStoreWrapper.removePin()

      expect(result).toBe(false)
    })
  })
})

describe("KeyStoreWrapper PIN-attempts methods", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("getPinAttemptsOrZero", () => {
    it("returns the stored attempts count as a number", async () => {
      mockGet.mockResolvedValue("3")

      const result = await KeyStoreWrapper.getPinAttemptsOrZero()

      expect(result).toBe(3)
      expect(mockGet).toHaveBeenCalledWith("pinAttempts")
    })

    it("returns 0 when the key is missing", async () => {
      mockGet.mockRejectedValue(new Error("not found"))

      const result = await KeyStoreWrapper.getPinAttemptsOrZero()

      expect(result).toBe(0)
    })
  })

  describe("setPinAttempts", () => {
    it("writes the attempts count with ALWAYS_THIS_DEVICE_ONLY accessibility", async () => {
      mockSet.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.setPinAttempts("2")

      expect(result).toBe(true)
      expect(mockSet).toHaveBeenCalledWith("pinAttempts", "2", {
        accessible: "ALWAYS_THIS_DEVICE_ONLY",
      })
    })

    it("returns false on storage error", async () => {
      mockSet.mockRejectedValue(new Error("write locked"))

      const result = await KeyStoreWrapper.setPinAttempts("2")

      expect(result).toBe(false)
    })
  })

  describe("resetPinAttempts", () => {
    it("delegates to setPinAttempts with '0'", async () => {
      mockSet.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.resetPinAttempts()

      expect(result).toBe(true)
      expect(mockSet).toHaveBeenCalledWith("pinAttempts", "0", {
        accessible: "ALWAYS_THIS_DEVICE_ONLY",
      })
    })
  })

  describe("removePinAttempts", () => {
    it("removes the attempts key and returns true", async () => {
      mockRemove.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.removePinAttempts()

      expect(result).toBe(true)
      expect(mockRemove).toHaveBeenCalledWith("pinAttempts")
    })

    it("returns false when the keystore rejects", async () => {
      mockRemove.mockRejectedValue(new Error("not found"))

      const result = await KeyStoreWrapper.removePinAttempts()

      expect(result).toBe(false)
    })
  })
})

describe("KeyStoreWrapper session-profile methods", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const profileA = {
    token: "tok-a",
    userId: "user-a",
    name: "Alice",
  } as unknown as ProfileProps
  const profileB = {
    token: "tok-b",
    userId: "user-b",
    name: "Bob",
  } as unknown as ProfileProps

  describe("saveSessionProfiles", () => {
    it("serializes profiles to JSON and writes them with ALWAYS_THIS_DEVICE_ONLY", async () => {
      mockSet.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.saveSessionProfiles([profileA, profileB])

      expect(result).toBe(true)
      expect(mockSet).toHaveBeenCalledWith(
        "sessionProfiles",
        JSON.stringify([profileA, profileB]),
        { accessible: "ALWAYS_THIS_DEVICE_ONLY" },
      )
    })

    it("returns false on storage error", async () => {
      mockSet.mockRejectedValue(new Error("write locked"))

      const result = await KeyStoreWrapper.saveSessionProfiles([profileA])

      expect(result).toBe(false)
    })
  })

  describe("getSessionProfiles", () => {
    it("parses and returns the stored profiles array", async () => {
      mockGet.mockResolvedValue(JSON.stringify([profileA, profileB]))

      const result = await KeyStoreWrapper.getSessionProfiles()

      expect(result).toEqual([profileA, profileB])
      expect(mockGet).toHaveBeenCalledWith("sessionProfiles")
    })

    it("returns an empty array when the key is missing", async () => {
      mockGet.mockRejectedValue(new Error("not found"))

      const result = await KeyStoreWrapper.getSessionProfiles()

      expect(result).toEqual([])
    })

    it("returns an empty array when the stored payload is empty", async () => {
      mockGet.mockResolvedValue("")

      const result = await KeyStoreWrapper.getSessionProfiles()

      expect(result).toEqual([])
    })
  })

  describe("removeSessionProfiles", () => {
    it("removes the sessionProfiles key and returns true", async () => {
      mockRemove.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.removeSessionProfiles()

      expect(result).toBe(true)
      expect(mockRemove).toHaveBeenCalledWith("sessionProfiles")
    })

    it("returns false when the keystore rejects", async () => {
      mockRemove.mockRejectedValue(new Error("not found"))

      const result = await KeyStoreWrapper.removeSessionProfiles()

      expect(result).toBe(false)
    })
  })

  describe("removeSessionProfileByToken", () => {
    it("filters out the matching token and rewrites the remaining profiles", async () => {
      mockGet.mockResolvedValue(JSON.stringify([profileA, profileB]))
      mockSet.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.removeSessionProfileByToken("tok-a")

      expect(result).toBe(true)
      expect(mockSet).toHaveBeenCalledWith(
        "sessionProfiles",
        JSON.stringify([profileB]),
        { accessible: "ALWAYS_THIS_DEVICE_ONLY" },
      )
    })

    it("rewrites the same list when no token matches", async () => {
      mockGet.mockResolvedValue(JSON.stringify([profileA, profileB]))
      mockSet.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.removeSessionProfileByToken("tok-missing")

      expect(result).toBe(true)
      expect(mockSet).toHaveBeenCalledWith(
        "sessionProfiles",
        JSON.stringify([profileA, profileB]),
        expect.any(Object),
      )
    })

    it("returns false when the rewrite fails", async () => {
      mockGet.mockResolvedValue(JSON.stringify([profileA, profileB]))
      mockSet.mockRejectedValue(new Error("write locked"))

      const result = await KeyStoreWrapper.removeSessionProfileByToken("tok-a")

      expect(result).toBe(false)
    })
  })
})
