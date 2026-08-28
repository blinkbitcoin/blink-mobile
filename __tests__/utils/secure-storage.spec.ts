import KeyStoreWrapper from "@app/utils/storage/secureStorage"

const mockGet = jest.fn()
const mockSet = jest.fn()
const mockRemove = jest.fn()

const mockSetInternet = jest.fn()
const mockGetInternet = jest.fn()
const mockHasInternet = jest.fn()
const mockResetInternet = jest.fn()

// The six non-mnemonic slots now read and write through the Keychain-backed
// store (blinkbitcoin/blink-wip#1161). The legacy mock below still drives every
// read: an unmigrated slot misses in the new store and falls through to it,
// which is the migration path itself.
jest.mock("react-native-keychain", () => ({
  __esModule: true,
  setInternetCredentials: (...args: unknown[]) => mockSetInternet(...args),
  getInternetCredentials: (...args: unknown[]) => mockGetInternet(...args),
  hasInternetCredentials: (...args: unknown[]) => mockHasInternet(...args),
  resetInternetCredentials: (...args: unknown[]) => mockResetInternet(...args),
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "AccessibleWhenUnlockedThisDeviceOnly",
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "AccessibleAfterFirstUnlockThisDeviceOnly",
  },
}))

/** What every migrated slot is written under — see MIGRATED_ACCESSIBLE. */
const MIGRATED_ACCESSIBLE = "AccessibleAfterFirstUnlockThisDeviceOnly"
/** Mnemonics keep the class they already had — see mnemonicSlotFor. */
const MNEMONIC_ACCESSIBLE = "AccessibleWhenUnlockedThisDeviceOnly"
const serverFor = (slot: string) => `secure-store.blink.local/${slot}`

/** A slot whose value still lives in the legacy store, as an upgrading install has it. */
const onlyInLegacyStore = (values: Record<string, string>) => {
  mockGetInternet.mockResolvedValue(false)
  mockGet.mockImplementation(async (key: string) => {
    if (key in values) return values[key]
    throw Object.assign(new Error("key does not present"), { code: "404" })
  })
}

const expectMigratedWrite = (slot: string, value: string) => {
  expect(mockSetInternet).toHaveBeenCalledWith(serverFor(slot), slot, value, {
    accessible: MIGRATED_ACCESSIBLE,
  })
}

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
    mockSetInternet.mockResolvedValue({ service: "mock" })
    mockGetInternet.mockResolvedValue(false)
    mockHasInternet.mockResolvedValue(false)
    mockResetInternet.mockResolvedValue(undefined)
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

    // The legacy primitives are the mnemonics' only path until
    // blinkbitcoin/blink-wip#1162, so the missing-key code still has to be told
    // apart from a real fault there.
    it("returns null for a key that is not there", async () => {
      mockGet.mockRejectedValue(
        Object.assign(new Error("key does not present"), { code: "404" }),
      )

      expect(await KeyStoreWrapper.getMnemonicForAccount("alice")).toBeNull()
    })

    it("returns null for a rejection carrying no code at all", async () => {
      mockGet.mockRejectedValue("not even an error")

      expect(await KeyStoreWrapper.getMnemonicForAccount("alice")).toBeNull()
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
    // Asserted literally, never expect.any(Object): a mnemonic rewritten at a
    // cloud-syncable class is a security regression that reads as a pass.
    it("writes 'mnemonic:{accountId}' to the new store at WHEN_UNLOCKED_THIS_DEVICE_ONLY", async () => {
      const result = await KeyStoreWrapper.setMnemonicForAccount("alice", "alpha beta")

      expect(result).toBe(true)
      expect(mockSetInternet).toHaveBeenCalledWith(
        "secure-store.blink.local/mnemonic:alice",
        "mnemonic:alice",
        "alpha beta",
        { accessible: MNEMONIC_ACCESSIBLE },
      )
      // Writes never read through: the legacy store is not written to.
      expect(mockSet).not.toHaveBeenCalled()
    })

    it("returns false on storage error (silent failure surfaces as boolean)", async () => {
      mockSetInternet.mockRejectedValue(new Error("keychain write-locked"))

      const result = await KeyStoreWrapper.setMnemonicForAccount("alice", "any words")

      expect(result).toBe(false)
    })

    it("isolates accounts by writing to a different key per id", async () => {
      await KeyStoreWrapper.setMnemonicForAccount("alice", "alice words")
      await KeyStoreWrapper.setMnemonicForAccount("bob", "bob words")

      expect(mockSetInternet).toHaveBeenCalledWith(
        "secure-store.blink.local/mnemonic:alice",
        "mnemonic:alice",
        "alice words",
        { accessible: MNEMONIC_ACCESSIBLE },
      )
      expect(mockSetInternet).toHaveBeenCalledWith(
        "secure-store.blink.local/mnemonic:bob",
        "mnemonic:bob",
        "bob words",
        { accessible: MNEMONIC_ACCESSIBLE },
      )
    })

    /**
     * Migrating alice's mnemonic under bob's key is worse than losing it: the
     * wallet that opens looks plausible and belongs to someone else.
     */
    it("does not answer for an account whose mnemonic was never stored", async () => {
      onlyInLegacyStore({ "mnemonic:alice": "alice words" })

      const bob = await KeyStoreWrapper.getMnemonicForAccount("bob")

      expect(bob).toBeNull()
      expect(mockSetInternet).not.toHaveBeenCalledWith(
        "secure-store.blink.local/mnemonic:bob",
        expect.anything(),
        expect.anything(),
        expect.anything(),
      )
    })

    it("migrates an unmigrated mnemonic under its own key, keeping the legacy copy", async () => {
      onlyInLegacyStore({ "mnemonic:alice": "alice words" })

      expect(await KeyStoreWrapper.getMnemonicForAccount("alice")).toBe("alice words")
      expect(mockSetInternet).toHaveBeenCalledWith(
        "secure-store.blink.local/mnemonic:alice",
        "mnemonic:alice",
        "alice words",
        { accessible: MNEMONIC_ACCESSIBLE },
      )
      // deleteLegacyOnMigrate is false for mnemonics: the old copy is the
      // rollback insurance and only the step 4 purge removes it.
      expect(mockRemove).not.toHaveBeenCalledWith("mnemonic:alice")
    })

    it("records the account in the list the reinstall wipe reads", async () => {
      await KeyStoreWrapper.setMnemonicForAccount("alice", "alice words")

      expect(mockSetInternet).toHaveBeenCalledWith(
        "secure-store.blink.local/mnemonicAccounts",
        "mnemonicAccounts",
        JSON.stringify(["alice"]),
        { accessible: MNEMONIC_ACCESSIBLE },
      )
    })

    it("records an account once, however often its mnemonic is rewritten", async () => {
      mockGetInternet.mockImplementation(async (server: string) =>
        server === "secure-store.blink.local/mnemonicAccounts"
          ? { username: "mnemonicAccounts", password: JSON.stringify(["alice"]) }
          : false,
      )

      await KeyStoreWrapper.setMnemonicForAccount("alice", "alice words")

      const listWrites = mockSetInternet.mock.calls.filter(
        ([server]) => server === "secure-store.blink.local/mnemonicAccounts",
      )
      expect(listWrites).toHaveLength(0)
    })

    it("starts a fresh list when the stored one is valid JSON but not a list", async () => {
      mockGetInternet.mockImplementation(async (server: string) =>
        server === "secure-store.blink.local/mnemonicAccounts"
          ? { username: "mnemonicAccounts", password: JSON.stringify({ alice: true }) }
          : false,
      )

      await KeyStoreWrapper.setMnemonicForAccount("alice", "alice words")

      expect(mockSetInternet).toHaveBeenCalledWith(
        "secure-store.blink.local/mnemonicAccounts",
        "mnemonicAccounts",
        JSON.stringify(["alice"]),
        { accessible: MNEMONIC_ACCESSIBLE },
      )
    })

    it("does not record an account whose mnemonic write failed", async () => {
      mockSetInternet.mockRejectedValue(new Error("keychain write-locked"))

      await KeyStoreWrapper.setMnemonicForAccount("alice", "alice words")

      expect(mockSetInternet).not.toHaveBeenCalledWith(
        "secure-store.blink.local/mnemonicAccounts",
        "mnemonicAccounts",
        expect.any(String),
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

    it("drops the account from the tracked list once its mnemonic is gone", async () => {
      mockGetInternet.mockImplementation(async (server: string) =>
        server === "secure-store.blink.local/mnemonicAccounts"
          ? { username: "mnemonicAccounts", password: JSON.stringify(["alice", "bob"]) }
          : false,
      )

      await KeyStoreWrapper.deleteMnemonicForAccount("alice")

      expect(mockSetInternet).toHaveBeenCalledWith(
        "secure-store.blink.local/mnemonicAccounts",
        "mnemonicAccounts",
        JSON.stringify(["bob"]),
        { accessible: MNEMONIC_ACCESSIBLE },
      )
    })

    it("removes the tracked list entirely with the last account", async () => {
      mockGetInternet.mockImplementation(async (server: string) =>
        server === "secure-store.blink.local/mnemonicAccounts"
          ? { username: "mnemonicAccounts", password: JSON.stringify(["alice"]) }
          : false,
      )

      await KeyStoreWrapper.deleteMnemonicForAccount("alice")

      expect(mockResetInternet).toHaveBeenCalledWith({
        server: "secure-store.blink.local/mnemonicAccounts",
      })
    })

    it("keeps the account tracked when its mnemonic is not provably gone", async () => {
      onlyInLegacyStore({ "mnemonic:alice": "still here" })
      mockRemove.mockRejectedValue(new Error("keystore unavailable"))
      mockGetInternet.mockImplementation(async (server: string) =>
        server === "secure-store.blink.local/mnemonicAccounts"
          ? { username: "mnemonicAccounts", password: JSON.stringify(["alice"]) }
          : false,
      )

      expect(await KeyStoreWrapper.deleteMnemonicForAccount("alice")).toBe(false)
      // Forgetting the id would leave a mnemonic nothing can reach.
      expect(mockResetInternet).not.toHaveBeenCalledWith({
        server: "secure-store.blink.local/mnemonicAccounts",
      })
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
    it("writes 'mnemonic_network:{accountId}' at WHEN_UNLOCKED_THIS_DEVICE_ONLY", async () => {
      const result = await KeyStoreWrapper.setMnemonicNetworkForAccount(
        "alice",
        "regtest",
      )

      expect(result).toBe(true)
      expect(mockSetInternet).toHaveBeenCalledWith(
        "secure-store.blink.local/mnemonic_network:alice",
        "mnemonic_network:alice",
        "regtest",
        { accessible: MNEMONIC_ACCESSIBLE },
      )
    })

    it("returns false on storage error", async () => {
      mockSetInternet.mockRejectedValue(new Error("storage error"))

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
    mockSetInternet.mockResolvedValue({ service: "mock" })
    mockGetInternet.mockResolvedValue(false)
    mockHasInternet.mockResolvedValue(false)
    mockResetInternet.mockResolvedValue(undefined)
  })

  describe("getIsBiometricsEnabled", () => {
    it("returns true when the flag exists in the keystore", async () => {
      mockGet.mockResolvedValue("1")

      const result = await KeyStoreWrapper.getIsBiometricsEnabled()

      expect(result).toBe(true)
      expect(mockGet).toHaveBeenCalledWith("isBiometricsEnabled")
    })

    it("returns false when the flag is missing", async () => {
      onlyInLegacyStore({})

      const result = await KeyStoreWrapper.getIsBiometricsEnabled()

      expect(result).toBe(false)
    })
  })

  describe("readIsBiometricsEnabled", () => {
    it("reports the flag as set", async () => {
      mockHasInternet.mockResolvedValue(true)

      expect(await KeyStoreWrapper.readIsBiometricsEnabled()).toEqual({ status: "yes" })
    })

    it("reports an unset flag as no, not as a failure", async () => {
      onlyInLegacyStore({})

      expect(await KeyStoreWrapper.readIsBiometricsEnabled()).toEqual({ status: "no" })
    })

    // The whole point of the sibling: a gate that scored this as "no" would
    // leave the app open for a user who does have a lock.
    it("reports a store that cannot answer as failed, never as no", async () => {
      mockHasInternet.mockRejectedValue(new Error("keystore locked"))
      mockGetInternet.mockRejectedValue(new Error("keystore locked"))

      expect(await KeyStoreWrapper.readIsBiometricsEnabled()).toMatchObject({
        status: "failed",
      })
    })

    it("finds a flag that has not migrated yet, and moves it while answering", async () => {
      onlyInLegacyStore({ isBiometricsEnabled: "1" })

      expect(await KeyStoreWrapper.readIsBiometricsEnabled()).toEqual({ status: "yes" })
      expectMigratedWrite("isBiometricsEnabled", "1")
      expect(mockRemove).toHaveBeenCalledWith("isBiometricsEnabled")
    })
  })

  describe("setIsBiometricsEnabled", () => {
    it("writes '1' with AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY accessibility", async () => {
      const result = await KeyStoreWrapper.setIsBiometricsEnabled()

      expect(result).toBe(true)
      expectMigratedWrite("isBiometricsEnabled", "1")
      expect(mockSet).not.toHaveBeenCalled()
    })

    it("returns false on storage error", async () => {
      mockSetInternet.mockRejectedValue(new Error("write locked"))

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
    mockSetInternet.mockResolvedValue({ service: "mock" })
    mockGetInternet.mockResolvedValue(false)
    mockHasInternet.mockResolvedValue(false)
    mockResetInternet.mockResolvedValue(undefined)
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

  describe("getPin", () => {
    it("returns the stored PIN", async () => {
      mockGet.mockResolvedValue("1234")

      const result = await KeyStoreWrapper.getPin()

      expect(result).toBe("1234")
    })

    it("returns null — not an empty PIN — when the read fails", async () => {
      // The whole point of the tri-state: "" would be compared against the
      // entry and scored as a wrong PIN, spending the attempt budget of a user
      // who typed nothing wrong.
      mockGet.mockRejectedValue(new Error("keystore locked"))

      const result = await KeyStoreWrapper.getPin()

      expect(result).toBeNull()
    })
  })

  describe("readIsPinEnabled", () => {
    it("reports a set PIN", async () => {
      mockHasInternet.mockResolvedValue(true)

      expect(await KeyStoreWrapper.readIsPinEnabled()).toEqual({ status: "yes" })
    })

    it("reports no PIN as no, not as a failure", async () => {
      onlyInLegacyStore({})

      expect(await KeyStoreWrapper.readIsPinEnabled()).toEqual({ status: "no" })
    })

    it("reports a store that cannot answer as failed, never as no", async () => {
      mockHasInternet.mockRejectedValue(new Error("keystore locked"))
      mockGetInternet.mockRejectedValue(new Error("keystore locked"))

      expect(await KeyStoreWrapper.readIsPinEnabled()).toMatchObject({ status: "failed" })
    })

    it("finds a PIN that has not migrated yet, and moves it while answering", async () => {
      onlyInLegacyStore({ PIN: "1234" })

      expect(await KeyStoreWrapper.readIsPinEnabled()).toEqual({ status: "yes" })
      expectMigratedWrite("PIN", "1234")
      expect(mockRemove).toHaveBeenCalledWith("PIN")
    })
  })

  describe("setPin", () => {
    it("writes the PIN with AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY accessibility", async () => {
      const result = await KeyStoreWrapper.setPin("1234")

      expect(result).toBe(true)
      expectMigratedWrite("PIN", "1234")
      expect(mockSet).not.toHaveBeenCalled()
    })

    it("returns false on storage error", async () => {
      mockSetInternet.mockRejectedValue(new Error("write locked"))

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

describe("KeyStoreWrapper PIN lockout state", () => {
  const missingKey = (message = "key has not been set") =>
    Object.assign(new Error(message), { code: "404" })

  /** Answers each key with its own stored value; anything else rejects the way
   *  the keystore does for a missing key. */
  const storedKeys = (values: Record<string, string>) => {
    mockGet.mockImplementation(async (key: string) => {
      if (key in values) return values[key]
      throw missingKey(`${key} has not been set`)
    })
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockSet.mockResolvedValue(undefined)
    mockRemove.mockResolvedValue(undefined)
    mockSetInternet.mockResolvedValue({ service: "mock" })
    mockGetInternet.mockResolvedValue(false)
    mockHasInternet.mockResolvedValue(false)
    mockResetInternet.mockResolvedValue(undefined)
  })

  describe("getPinFailureState", () => {
    it("reads the count and the lock from one key", async () => {
      storedKeys({
        pinFailureState: JSON.stringify({ attempts: 2, lockedUntil: 1700000060000 }),
      })

      const result = await KeyStoreWrapper.getPinFailureState()

      expect(result).toEqual({
        status: "found",
        state: { attempts: 2, lockedUntil: 1700000060000 },
      })
      expect(mockGet).toHaveBeenCalledWith("pinFailureState")
    })

    it("reports a clean slate when nothing is stored", async () => {
      storedKeys({})

      expect(await KeyStoreWrapper.getPinFailureState()).toEqual({ status: "absent" })
    })

    it("reads back a clean slate for a corrupt or non-finite value", async () => {
      // NaN would slip past every `<` comparison downstream and silently pick
      // the wrong branch, so it must never escape this layer.
      for (const stored of [
        "not json",
        JSON.stringify({ attempts: "abc", lockedUntil: 1 }),
        JSON.stringify({ attempts: 1, lockedUntil: "Infinity" }),
        JSON.stringify(null),
      ]) {
        storedKeys({ pinFailureState: stored })

        expect(await KeyStoreWrapper.getPinFailureState()).toEqual({
          status: "found",
          state: { attempts: 0, lockedUntil: 0 },
        })
      }
    })

    it("reads a non-numeric legacy count back as a clean slate", async () => {
      storedKeys({ pinAttempts: "not a number" })

      expect(await KeyStoreWrapper.getPinFailureState()).toEqual({
        status: "found",
        state: { attempts: 0, lockedUntil: 0 },
      })
    })

    it("carries a pre-lockout install's attempt count over from the legacy key", async () => {
      // Upgrading must not hand back a budget the user already spent.
      storedKeys({ pinAttempts: "2" })

      expect(await KeyStoreWrapper.getPinFailureState()).toEqual({
        status: "found",
        state: { attempts: 2, lockedUntil: 0 },
      })
    })

    it("ignores the legacy key once the new one exists", async () => {
      storedKeys({
        pinAttempts: "2",
        pinFailureState: JSON.stringify({ attempts: 0, lockedUntil: 0 }),
      })

      expect(await KeyStoreWrapper.getPinFailureState()).toEqual({
        status: "found",
        state: { attempts: 0, lockedUntil: 0 },
      })
    })

    it("does not fall back when reading the current state fails", async () => {
      const readError = new Error("keystore unavailable")
      mockGet.mockImplementation(async (key: string) => {
        if (key === "pinFailureState") throw readError
        if (key === "pinAttempts") return "2"
        throw missingKey()
      })

      await expect(KeyStoreWrapper.getPinFailureState()).resolves.toEqual({
        status: "failed",
        err: readError,
      })
      expect(mockGet).not.toHaveBeenCalledWith("pinAttempts")
    })

    it("does not treat a failed legacy read as a clean state", async () => {
      const readError = new Error("keystore unavailable")
      mockGet.mockImplementation(async (key: string) => {
        if (key === "pinFailureState") throw missingKey()
        throw readError
      })

      await expect(KeyStoreWrapper.getPinFailureState()).resolves.toEqual({
        status: "failed",
        err: readError,
      })
    })
  })

  describe("migrating the lockout slots", () => {
    it("moves a lockout state that still lives in the legacy store", async () => {
      const stored = JSON.stringify({ attempts: 2, lockedUntil: 1700000060000 })
      onlyInLegacyStore({ pinFailureState: stored })

      expect(await KeyStoreWrapper.getPinFailureState()).toEqual({
        status: "found",
        state: { attempts: 2, lockedUntil: 1700000060000 },
      })
      expectMigratedWrite("pinFailureState", stored)
      expect(mockRemove).toHaveBeenCalledWith("pinFailureState")
    })

    it("moves a pre-lockout install's bare attempt count, budget intact", async () => {
      onlyInLegacyStore({ pinAttempts: "2" })

      expect(await KeyStoreWrapper.getPinFailureState()).toEqual({
        status: "found",
        state: { attempts: 2, lockedUntil: 0 },
      })
      expectMigratedWrite("pinAttempts", "2")
      expect(mockRemove).toHaveBeenCalledWith("pinAttempts")
    })
  })

  describe("setPinFailureState", () => {
    it("writes one value under one key with AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY accessibility", async () => {
      const result = await KeyStoreWrapper.setPinFailureState({
        attempts: 2,
        lockedUntil: 1700000060000,
      })

      expect(result).toBe(true)
      expect(mockSetInternet).toHaveBeenCalledTimes(1)
      expectMigratedWrite(
        "pinFailureState",
        JSON.stringify({ attempts: 2, lockedUntil: 1700000060000 }),
      )
    })

    it("drops the legacy key once the state has moved", async () => {
      await KeyStoreWrapper.setPinFailureState({ attempts: 1, lockedUntil: 0 })

      expect(mockRemove).toHaveBeenCalledWith("pinAttempts")
    })

    it("reports failure — and leaves the legacy key alone — when the write is rejected", async () => {
      // Single write, so `false` is the whole truth: nothing was recorded, and
      // the caller must treat the failure as unrecorded rather than half-kept.
      mockSetInternet.mockRejectedValue(new Error("write locked"))

      const result = await KeyStoreWrapper.setPinFailureState({
        attempts: 1,
        lockedUntil: 1700000030000,
      })

      expect(result).toBe(false)
      expect(mockRemove).not.toHaveBeenCalled()
    })
  })

  describe("clearPinFailureState", () => {
    it("drops both the current and the legacy key", async () => {
      const result = await KeyStoreWrapper.clearPinFailureState()

      expect(result).toBe(true)
      expect(mockRemove).toHaveBeenCalledWith("pinFailureState")
      expect(mockRemove).toHaveBeenCalledWith("pinAttempts")
      expect(mockSetInternet).not.toHaveBeenCalled()
    })

    it("writes nothing when the erase only failed because nothing was stored", async () => {
      mockRemove.mockRejectedValue(new Error("not found"))
      storedKeys({})

      expect(await KeyStoreWrapper.clearPinFailureState()).toBe(true)
      expect(mockSet).not.toHaveBeenCalled()
    })

    it("writes a cleared value when a failed erase left state readable", async () => {
      // Otherwise a spent budget survives a correct PIN, and the next typo logs
      // the user out on the spot.
      mockRemove.mockRejectedValue(new Error("keystore locked"))
      storedKeys({
        pinFailureState: JSON.stringify({ attempts: 3, lockedUntil: 1700000060000 }),
      })

      expect(await KeyStoreWrapper.clearPinFailureState()).toBe(true)
      expectMigratedWrite(
        "pinFailureState",
        JSON.stringify({ attempts: 0, lockedUntil: 0 }),
      )
    })

    it("writes a cleared value when the fallback read also fails", async () => {
      mockRemove.mockRejectedValue(new Error("keystore locked"))
      mockGet.mockRejectedValue(new Error("keystore unavailable"))

      expect(await KeyStoreWrapper.clearPinFailureState()).toBe(true)
      expectMigratedWrite(
        "pinFailureState",
        JSON.stringify({ attempts: 0, lockedUntil: 0 }),
      )
    })

    it("repairs a legacy count that would not erase", async () => {
      mockRemove.mockRejectedValue(new Error("keystore locked"))
      storedKeys({ pinAttempts: "3" })

      expect(await KeyStoreWrapper.clearPinFailureState()).toBe(true)
      expectMigratedWrite(
        "pinFailureState",
        JSON.stringify({ attempts: 0, lockedUntil: 0 }),
      )
    })

    // An erase reports failure for a key that was never there too, so a failed
    // erase over nothing readable is a clear, not a fault: writing on it would
    // put an item back where none was.
    it("writes nothing when a failed erase left the slot empty anyway", async () => {
      onlyInLegacyStore({})
      mockResetInternet.mockRejectedValue(new Error("keystore locked"))

      expect(await KeyStoreWrapper.clearPinFailureState()).toBe(true)
      expect(mockSetInternet).not.toHaveBeenCalled()
    })

    it("writes nothing when a failed erase left an already-clean slate", async () => {
      // The legacy copy is there and will not drop, so the erase genuinely
      // fails and the fallback has to decide on what is still readable.
      onlyInLegacyStore({
        pinFailureState: JSON.stringify({ attempts: 0, lockedUntil: 0 }),
      })
      mockRemove.mockRejectedValue(new Error("keystore locked"))

      expect(await KeyStoreWrapper.clearPinFailureState()).toBe(true)
      // The one write is the migrating read moving the value across, not a
      // clear written over a slate that was already clean.
      expect(mockSetInternet).toHaveBeenCalledTimes(1)
    })

    it("reports false when neither the erase nor the repair lands", async () => {
      mockRemove.mockRejectedValue(new Error("keystore locked"))
      mockSetInternet.mockRejectedValue(new Error("keystore locked"))
      storedKeys({ pinFailureState: JSON.stringify({ attempts: 3, lockedUntil: 0 }) })

      expect(await KeyStoreWrapper.clearPinFailureState()).toBe(false)
    })
  })
})

describe("KeyStoreWrapper session-profile methods", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSetInternet.mockResolvedValue({ service: "mock" })
    mockGetInternet.mockResolvedValue(false)
    mockHasInternet.mockResolvedValue(false)
    mockResetInternet.mockResolvedValue(undefined)
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

  // Both native modules reject a missing key rather than resolving empty, and
  // only this code separates "nothing stored" from "the read went wrong".
  const keyNotFound = () =>
    Object.assign(new Error("key does not present"), { code: "404" })

  describe("saveSessionProfiles", () => {
    it("serializes profiles to JSON and writes them with AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY", async () => {
      const result = await KeyStoreWrapper.saveSessionProfiles([profileA, profileB])

      expect(result).toBe(true)
      expectMigratedWrite("sessionProfiles", JSON.stringify([profileA, profileB]))
    })

    it("returns false on storage error", async () => {
      mockSetInternet.mockRejectedValue(new Error("write locked"))

      const result = await KeyStoreWrapper.saveSessionProfiles([profileA])

      expect(result).toBe(false)
    })

    it("returns false without writing when the profiles cannot be serialized", async () => {
      const circular: Record<string, unknown> = { token: "tok-a" }
      circular.self = circular

      const result = await KeyStoreWrapper.saveSessionProfiles([
        circular as unknown as ProfileProps,
      ])

      expect(result).toBe(false)
      expect(mockSet).not.toHaveBeenCalled()
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
      mockGet.mockRejectedValue(keyNotFound())

      const result = await KeyStoreWrapper.getSessionProfiles()

      expect(result).toEqual([])
    })

    it("returns an empty array when the stored payload is empty", async () => {
      mockGet.mockResolvedValue("")

      const result = await KeyStoreWrapper.getSessionProfiles()

      expect(result).toEqual([])
    })

    it("collapses a failed read to an empty array", async () => {
      mockGet.mockRejectedValue(new Error("keystore locked"))

      const result = await KeyStoreWrapper.getSessionProfiles()

      expect(result).toEqual([])
    })
  })

  describe("readSessionProfiles", () => {
    it("returns the stored profiles as found", async () => {
      mockGet.mockResolvedValue(JSON.stringify([profileA, profileB]))

      const result = await KeyStoreWrapper.readSessionProfiles()

      expect(result).toEqual({ status: "found", profiles: [profileA, profileB] })
      expect(mockGet).toHaveBeenCalledWith("sessionProfiles")
    })

    it("reports absent when the key is not there", async () => {
      mockGet.mockRejectedValue(keyNotFound())

      const result = await KeyStoreWrapper.readSessionProfiles()

      expect(result).toEqual({ status: "absent" })
    })

    it("reports absent when the stored payload is empty", async () => {
      mockGet.mockResolvedValue("")

      const result = await KeyStoreWrapper.readSessionProfiles()

      expect(result).toEqual({ status: "absent" })
    })

    it("reports failed when the read fails for any reason other than a missing key", async () => {
      const err = new Error("keystore locked")
      mockGet.mockRejectedValue(err)

      const result = await KeyStoreWrapper.readSessionProfiles()

      expect(result).toEqual({ status: "failed", err })
    })

    // A payload nobody can parse holds no session to protect, so it is reported
    // absent and the next write heals the slot rather than being refused forever.
    it("reports absent when the stored payload will not parse", async () => {
      mockGet.mockResolvedValue("{ truncated")

      const result = await KeyStoreWrapper.readSessionProfiles()

      expect(result).toEqual({ status: "absent" })
    })

    it("reports absent when the stored payload parses to something other than an array", async () => {
      mockGet.mockResolvedValue(JSON.stringify({ token: "tok-a" }))

      const result = await KeyStoreWrapper.readSessionProfiles()

      expect(result).toEqual({ status: "absent" })
    })
  })

  describe("migrating the session-profile slot", () => {
    it("moves a profile list that still lives in the legacy store", async () => {
      const stored = JSON.stringify([profileA, profileB])
      onlyInLegacyStore({ sessionProfiles: stored })

      expect(await KeyStoreWrapper.getSessionProfiles()).toEqual([profileA, profileB])
      expectMigratedWrite("sessionProfiles", stored)
      expect(mockRemove).toHaveBeenCalledWith("sessionProfiles")
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
      expectMigratedWrite("sessionProfiles", JSON.stringify([profileB]))
    })

    it("rewrites the same list when no token matches", async () => {
      mockGet.mockResolvedValue(JSON.stringify([profileA, profileB]))
      mockSet.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.removeSessionProfileByToken("tok-missing")

      expect(result).toBe(true)
      expectMigratedWrite("sessionProfiles", JSON.stringify([profileA, profileB]))
    })

    it("returns false when the rewrite fails", async () => {
      mockGet.mockResolvedValue(JSON.stringify([profileA, profileB]))
      mockSetInternet.mockRejectedValue(new Error("write locked"))

      const result = await KeyStoreWrapper.removeSessionProfileByToken("tok-a")

      expect(result).toBe(false)
    })

    it("writes nothing when the read fails, leaving the other profiles stored", async () => {
      mockGet.mockRejectedValue(new Error("keystore locked"))
      mockSet.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.removeSessionProfileByToken("tok-a")

      expect(result).toBe(false)
      expect(mockSet).not.toHaveBeenCalled()
    })

    it("writes nothing when no profiles are stored", async () => {
      mockGet.mockRejectedValue(keyNotFound())
      mockSet.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.removeSessionProfileByToken("tok-a")

      expect(result).toBe(true)
      expect(mockSet).not.toHaveBeenCalled()
    })
  })
})

describe("KeyStoreWrapper active-token methods", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSetInternet.mockResolvedValue({ service: "mock" })
    mockGetInternet.mockResolvedValue(false)
    mockHasInternet.mockResolvedValue(false)
    mockResetInternet.mockResolvedValue(undefined)
  })

  describe("getActiveToken", () => {
    it("returns the stored token from the 'galoyAuthToken' key", async () => {
      mockGet.mockResolvedValue("ory_st_secret")

      const result = await KeyStoreWrapper.getActiveToken()

      expect(result).toBe("ory_st_secret")
      expect(mockGet).toHaveBeenCalledWith("galoyAuthToken")
    })

    it("returns an empty string when the key is missing or the keystore fails", async () => {
      mockGet.mockRejectedValue(new Error("not found"))

      const result = await KeyStoreWrapper.getActiveToken()

      expect(result).toBe("")
    })
  })

  describe("readActiveToken", () => {
    // Both native modules reject a missing key rather than resolving empty, so
    // "no token" and "the read went wrong" arrive as the same rejection and
    // only the code separates them. Callers that would overwrite or delete a
    // credential on an empty read depend on this distinction.
    const keyNotFound = () =>
      Object.assign(new Error("key does not present"), {
        code: "404",
      })

    it("reports a stored token as found", async () => {
      mockGet.mockResolvedValue("ory_st_secret")

      expect(await KeyStoreWrapper.readActiveToken()).toEqual({
        status: "found",
        token: "ory_st_secret",
      })
    })

    it("reports the 404 rejection as absent, not as a failure", async () => {
      mockGet.mockRejectedValue(keyNotFound())

      expect(await KeyStoreWrapper.readActiveToken()).toEqual({ status: "absent" })
    })

    it("reports any other rejection as a failed read", async () => {
      const err = Object.assign(new Error("keystore locked"), { code: "9" })
      mockGet.mockRejectedValue(err)

      expect(await KeyStoreWrapper.readActiveToken()).toEqual({ status: "failed", err })
    })

    it("treats a codeless rejection as a failed read rather than assuming absence", async () => {
      mockGet.mockRejectedValue(new Error("something unexpected"))

      const result = await KeyStoreWrapper.readActiveToken()

      expect(result.status).toBe("failed")
    })

    it("collapses to an empty string through getActiveToken either way", async () => {
      mockGet.mockRejectedValue(keyNotFound())
      expect(await KeyStoreWrapper.getActiveToken()).toBe("")

      mockGet.mockRejectedValue(new Error("keystore locked"))
      expect(await KeyStoreWrapper.getActiveToken()).toBe("")
    })
  })

  describe("migrating the active-token slot", () => {
    it("moves a token that still lives in the legacy store", async () => {
      onlyInLegacyStore({ galoyAuthToken: "ory_st_secret" })

      expect(await KeyStoreWrapper.readActiveToken()).toEqual({
        status: "found",
        token: "ory_st_secret",
      })
      expectMigratedWrite("galoyAuthToken", "ory_st_secret")
      expect(mockRemove).toHaveBeenCalledWith("galoyAuthToken")
    })

    // The steady state after migration: the legacy library is never touched
    // again, which is what keeps its unscoped reinstall wipe from firing.
    it("stops reading the legacy store once the token has moved", async () => {
      mockGetInternet.mockResolvedValue({
        username: "galoyAuthToken",
        password: "ory_st_secret",
      })

      expect(await KeyStoreWrapper.readActiveToken()).toEqual({
        status: "found",
        token: "ory_st_secret",
      })
      expect(mockGet).not.toHaveBeenCalled()
    })
  })

  describe("setActiveToken", () => {
    it("writes the token with AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY accessibility", async () => {
      const result = await KeyStoreWrapper.setActiveToken("ory_st_secret")

      expect(result).toBe(true)
      expectMigratedWrite("galoyAuthToken", "ory_st_secret")
      expect(mockSet).not.toHaveBeenCalled()
    })

    it("returns false on storage error", async () => {
      mockSetInternet.mockRejectedValue(new Error("write locked"))

      const result = await KeyStoreWrapper.setActiveToken("ory_st_secret")

      expect(result).toBe(false)
    })
  })

  describe("removeActiveToken", () => {
    it("removes the key and returns true", async () => {
      mockRemove.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.removeActiveToken()

      expect(result).toBe(true)
      expect(mockRemove).toHaveBeenCalledWith("galoyAuthToken")
    })

    it("returns false when the keystore rejects", async () => {
      mockRemove.mockRejectedValue(new Error("keystore unavailable"))

      const result = await KeyStoreWrapper.removeActiveToken()

      expect(result).toBe(false)
    })
  })
})

describe("KeyStoreWrapper clearUninstallSurvivingCredentials", () => {
  const onFailure = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockRemove.mockResolvedValue(undefined)
    mockSetInternet.mockResolvedValue({ service: "mock" })
    mockGetInternet.mockResolvedValue(false)
    mockHasInternet.mockResolvedValue(false)
    mockResetInternet.mockResolvedValue(undefined)
    // Nothing left in the legacy store, so a removal that reports failure is
    // reporting the new store's failure and not a key that was never there.
    onlyInLegacyStore({})
  })

  /** A slot the legacy store still holds and refuses to give up: the removal is
   *  not provably done, which is the only thing that counts as a failure. */
  const legacyRefusesToDrop = (slot: string) => {
    onlyInLegacyStore({ [slot]: "still here" })
    mockRemove.mockRejectedValue(new Error("keystore unavailable"))
  }

  it("removes every uninstall-surviving slot, and only those", async () => {
    await KeyStoreWrapper.clearUninstallSurvivingCredentials(onFailure)

    for (const slot of [
      "galoyAuthToken",
      "sessionProfiles",
      // The app lock survives an uninstall in the new store exactly as the
      // session did, and a reinstall booting into someone else's PIN strands
      // whoever installs next.
      "PIN",
      "pinFailureState",
      "pinAttempts",
      "isBiometricsEnabled",
    ]) {
      expect(mockRemove).toHaveBeenCalledWith(slot)
    }
    // The bare keys name no account and must never be touched, however the
    // per-account ones are reached.
    expect(mockRemove).not.toHaveBeenCalledWith("mnemonic")
    expect(mockRemove).not.toHaveBeenCalledWith("mnemonic_network")
    expect(onFailure).not.toHaveBeenCalled()
  })

  /**
   * The mnemonics are the reason this wipe exists at all now: the legacy
   * library's own reinstall sweep used to clear them by accident, and with
   * every slot behind the read-through helper that sweep never fires.
   */
  it("clears the mnemonic of every tracked account", async () => {
    mockGetInternet.mockImplementation(async (server: string) =>
      server === "secure-store.blink.local/mnemonicAccounts"
        ? { username: "mnemonicAccounts", password: JSON.stringify(["alice", "bob"]) }
        : false,
    )

    await KeyStoreWrapper.clearUninstallSurvivingCredentials(onFailure)

    for (const slot of [
      "mnemonic:alice",
      "mnemonic_network:alice",
      "mnemonic:bob",
      "mnemonic_network:bob",
    ]) {
      expect(mockResetInternet).toHaveBeenCalledWith({
        server: `secure-store.blink.local/${slot}`,
      })
    }
    expect(onFailure).not.toHaveBeenCalled()
  })

  it("reports the list rather than claiming a clean wipe it cannot verify", async () => {
    mockGetInternet.mockImplementation(async (server: string) => {
      if (server === "secure-store.blink.local/mnemonicAccounts") {
        throw new Error("keychain unavailable")
      }
      return false
    })

    await KeyStoreWrapper.clearUninstallSurvivingCredentials(onFailure)

    expect(onFailure).toHaveBeenCalledWith("mnemonic account list")
  })

  it("reports a list it cannot parse rather than reading it as no accounts", async () => {
    mockGetInternet.mockImplementation(async (server: string) =>
      server === "secure-store.blink.local/mnemonicAccounts"
        ? { username: "mnemonicAccounts", password: "not json at all" }
        : false,
    )

    await KeyStoreWrapper.clearUninstallSurvivingCredentials(onFailure)

    expect(onFailure).toHaveBeenCalledWith("mnemonic account list")
  })

  it("clears nothing extra when no account was ever tracked", async () => {
    await KeyStoreWrapper.clearUninstallSurvivingCredentials(onFailure)

    const mnemonicResets = mockResetInternet.mock.calls.filter(([arg]) =>
      String((arg as { server: string }).server).includes("mnemonic"),
    )
    expect(mnemonicResets).toHaveLength(0)
    expect(onFailure).not.toHaveBeenCalled()
  })

  it("retries a failed removal once and stays silent when the retry lands", async () => {
    onlyInLegacyStore({ galoyAuthToken: "still here" })
    mockRemove
      .mockRejectedValueOnce(new Error("keystore busy")) // token, attempt 1
      .mockResolvedValue(undefined)

    await KeyStoreWrapper.clearUninstallSurvivingCredentials(onFailure)

    const tokenAttempts = mockRemove.mock.calls.filter(([k]) => k === "galoyAuthToken")
    expect(tokenAttempts).toHaveLength(2)
    expect(onFailure).not.toHaveBeenCalled()
  })

  it("reports a persistently failing token removal and still wipes the profiles", async () => {
    legacyRefusesToDrop("galoyAuthToken")
    mockRemove.mockImplementation((key: string) =>
      key === "galoyAuthToken"
        ? Promise.reject(new Error("keystore unavailable"))
        : Promise.resolve(undefined),
    )

    await KeyStoreWrapper.clearUninstallSurvivingCredentials(onFailure)

    expect(onFailure).toHaveBeenCalledTimes(1)
    expect(onFailure).toHaveBeenCalledWith("active token")
    // One slot failing must not stop the other from being cleared.
    expect(mockRemove).toHaveBeenCalledWith("sessionProfiles")
  })

  it("reports a persistently failing profile removal by name", async () => {
    legacyRefusesToDrop("sessionProfiles")

    await KeyStoreWrapper.clearUninstallSurvivingCredentials(onFailure)

    expect(onFailure).toHaveBeenCalledTimes(1)
    expect(onFailure).toHaveBeenCalledWith("session profiles")
  })

  it("reports every slot when the keystore is fully unavailable, and never throws", async () => {
    mockGet.mockRejectedValue(new Error("keystore unavailable"))
    mockRemove.mockRejectedValue(new Error("keystore unavailable"))

    await expect(
      KeyStoreWrapper.clearUninstallSurvivingCredentials(onFailure),
    ).resolves.toBeUndefined()

    // The lockout state is absent from this list on purpose: clearing it falls
    // back to writing a clean slate when the erase fails, and a stored
    // {attempts: 0, lockedUntil: 0} strands nobody.
    expect(onFailure.mock.calls.flat()).toEqual([
      "active token",
      "session profiles",
      "pin",
      "biometrics flag",
    ])
  })
})
