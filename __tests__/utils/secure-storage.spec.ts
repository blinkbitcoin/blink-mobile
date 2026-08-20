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
        "",
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

  describe("setPinFailureState", () => {
    it("writes one value under one key with ALWAYS_THIS_DEVICE_ONLY accessibility", async () => {
      const result = await KeyStoreWrapper.setPinFailureState({
        attempts: 2,
        lockedUntil: 1700000060000,
      })

      expect(result).toBe(true)
      expect(mockSet).toHaveBeenCalledTimes(1)
      expect(mockSet).toHaveBeenCalledWith(
        "pinFailureState",
        JSON.stringify({ attempts: 2, lockedUntil: 1700000060000 }),
        { accessible: "ALWAYS_THIS_DEVICE_ONLY" },
      )
    })

    it("drops the legacy key once the state has moved", async () => {
      await KeyStoreWrapper.setPinFailureState({ attempts: 1, lockedUntil: 0 })

      expect(mockRemove).toHaveBeenCalledWith("pinAttempts")
    })

    it("reports failure — and leaves the legacy key alone — when the write is rejected", async () => {
      // Single write, so `false` is the whole truth: nothing was recorded, and
      // the caller must treat the failure as unrecorded rather than half-kept.
      mockSet.mockRejectedValue(new Error("write locked"))

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
      expect(mockSet).not.toHaveBeenCalled()
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
      expect(mockSet).toHaveBeenCalledWith(
        "pinFailureState",
        JSON.stringify({ attempts: 0, lockedUntil: 0 }),
        { accessible: "ALWAYS_THIS_DEVICE_ONLY" },
      )
    })

    it("writes a cleared value when the fallback read also fails", async () => {
      mockRemove.mockRejectedValue(new Error("keystore locked"))
      mockGet.mockRejectedValue(new Error("keystore unavailable"))

      expect(await KeyStoreWrapper.clearPinFailureState()).toBe(true)
      expect(mockSet).toHaveBeenCalledWith(
        "pinFailureState",
        JSON.stringify({ attempts: 0, lockedUntil: 0 }),
        { accessible: "ALWAYS_THIS_DEVICE_ONLY" },
      )
    })

    it("repairs a legacy count that would not erase", async () => {
      mockRemove.mockRejectedValue(new Error("keystore locked"))
      storedKeys({ pinAttempts: "3" })

      expect(await KeyStoreWrapper.clearPinFailureState()).toBe(true)
      expect(mockSet).toHaveBeenCalledWith(
        "pinFailureState",
        JSON.stringify({ attempts: 0, lockedUntil: 0 }),
        { accessible: "ALWAYS_THIS_DEVICE_ONLY" },
      )
    })

    it("reports false when neither the erase nor the repair lands", async () => {
      mockRemove.mockRejectedValue(new Error("keystore locked"))
      mockSet.mockRejectedValue(new Error("keystore locked"))
      storedKeys({ pinFailureState: JSON.stringify({ attempts: 3, lockedUntil: 0 }) })

      expect(await KeyStoreWrapper.clearPinFailureState()).toBe(false)
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

describe("KeyStoreWrapper active-token methods", () => {
  beforeEach(() => {
    jest.clearAllMocks()
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

  describe("setActiveToken", () => {
    it("writes the token with ALWAYS_THIS_DEVICE_ONLY accessibility", async () => {
      mockSet.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.setActiveToken("ory_st_secret")

      expect(result).toBe(true)
      expect(mockSet).toHaveBeenCalledWith("galoyAuthToken", "ory_st_secret", {
        accessible: "ALWAYS_THIS_DEVICE_ONLY",
      })
    })

    it("returns false on storage error", async () => {
      mockSet.mockRejectedValue(new Error("write locked"))

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
  })

  it("removes the active token and the session profiles, and only those", async () => {
    await KeyStoreWrapper.clearUninstallSurvivingCredentials(onFailure)

    expect(mockRemove).toHaveBeenCalledWith("galoyAuthToken")
    expect(mockRemove).toHaveBeenCalledWith("sessionProfiles")
    // Mnemonics are deliberately NOT wiped (wallet keys outliving uninstall
    // is a product decision, not cleanup) — nothing else may be touched.
    expect(mockRemove).toHaveBeenCalledTimes(2)
    expect(onFailure).not.toHaveBeenCalled()
  })

  it("retries a failed removal once and stays silent when the retry lands", async () => {
    mockRemove
      .mockRejectedValueOnce(new Error("keystore busy")) // token, attempt 1
      .mockResolvedValue(undefined)

    await KeyStoreWrapper.clearUninstallSurvivingCredentials(onFailure)

    const tokenAttempts = mockRemove.mock.calls.filter(([k]) => k === "galoyAuthToken")
    expect(tokenAttempts).toHaveLength(2)
    expect(onFailure).not.toHaveBeenCalled()
  })

  it("reports a persistently failing token removal and still wipes the profiles", async () => {
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
    mockRemove.mockImplementation((key: string) =>
      key === "sessionProfiles"
        ? Promise.reject(new Error("keystore unavailable"))
        : Promise.resolve(undefined),
    )

    await KeyStoreWrapper.clearUninstallSurvivingCredentials(onFailure)

    expect(onFailure).toHaveBeenCalledTimes(1)
    expect(onFailure).toHaveBeenCalledWith("session profiles")
  })

  it("reports every slot when the keystore is fully unavailable, and never throws", async () => {
    mockRemove.mockRejectedValue(new Error("keystore unavailable"))

    await expect(
      KeyStoreWrapper.clearUninstallSurvivingCredentials(onFailure),
    ).resolves.toBeUndefined()

    expect(onFailure).toHaveBeenCalledTimes(2)
    expect(onFailure).toHaveBeenNthCalledWith(1, "active token")
    expect(onFailure).toHaveBeenNthCalledWith(2, "session profiles")
  })
})
