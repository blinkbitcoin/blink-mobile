import { Platform } from "react-native"

import KeyStoreWrapper from "@app/utils/storage/secureStorage"

/** eraseEntireLegacyStore is a no-op off iOS, so the platform has to be pinned. */
const setPlatform = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: os })
}
const ORIGINAL_PLATFORM = Platform.OS

const mockGet = jest.fn()
const mockSet = jest.fn()
const mockRemove = jest.fn()

const mockSetInternet = jest.fn()
const mockGetInternet = jest.fn()
const mockHasInternet = jest.fn()
const mockResetInternet = jest.fn()
const mockResetGenericPassword = jest.fn()

const mockRecordError = jest.fn()
const mockCrashlyticsLog = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
  log: (...args: unknown[]) => mockCrashlyticsLog(...args),
}))

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
  // Reached only by the reinstall wipe's final, service-scoped erase of the
  // legacy store — see eraseEntireLegacyStore.
  resetGenericPassword: (...args: unknown[]) => mockResetGenericPassword(...args),
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

  describe("readMnemonicWithStatus — legacy hit whose migrating write fails", () => {
    /**
     * The contract the boot sweep counts. A read that found the value in the
     * legacy store answers "found" whether or not the write that was supposed to
     * move it succeeded, because migration bookkeeping must never cost
     * availability. The cost is that "found" alone does not mean "migrated", so
     * a device whose keychain refuses every write reports a clean sweep while
     * nothing has moved.
     */
    it("answers with the legacy value and leaves the legacy copy in place", async () => {
      mockGet.mockResolvedValue("alice words")
      mockSetInternet.mockRejectedValue(new Error("keychain write refused"))

      const read = await KeyStoreWrapper.readMnemonicWithStatus("alice")

      expect(read).toMatchObject({ status: "found", value: "alice words" })
      // The move was attempted and refused, so the value is still only in the
      // legacy store.
      expect(mockSetInternet).toHaveBeenCalledWith(
        "secure-store.blink.local/mnemonic:alice",
        "mnemonic:alice",
        "alice words",
        { accessible: MNEMONIC_ACCESSIBLE },
      )
      // Never erased on a migrating read: the old copy is the rollback
      // insurance, and erasing it here would lose the seed outright.
      expect(mockRemove).not.toHaveBeenCalledWith("mnemonic:alice")
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
        "alice",
        { accessible: MNEMONIC_ACCESSIBLE },
      )
    })

    it("records an account once, however often its mnemonic is rewritten", async () => {
      mockGetInternet.mockImplementation(async (server: string) =>
        server === "secure-store.blink.local/mnemonicAccounts"
          ? { username: "mnemonicAccounts", password: "alice" }
          : false,
      )

      await KeyStoreWrapper.setMnemonicForAccount("alice", "alice words")

      const listWrites = mockSetInternet.mock.calls.filter(
        ([server]) => server === "secure-store.blink.local/mnemonicAccounts",
      )
      expect(listWrites).toHaveLength(0)
    })

    /**
     * The property the line format buys. A damaged value used to be rejected
     * whole: one bad byte skipped the reinstall wipe entirely, and the repair
     * could not help because it rebuilds from an index a reinstall has cleared.
     * Per line, the damage is contained — the ids that survived are still read,
     * still written back, and still reachable by the wipe.
     */
    it("keeps the ids a damaged value did not touch, instead of rejecting all of them", async () => {
      mockGetInternet.mockImplementation(async (server: string) =>
        server === "secure-store.blink.local/mnemonicAccounts"
          ? { username: "mnemonicAccounts", password: "alice\n\u0000garbage\nbob" }
          : false,
      )

      await KeyStoreWrapper.setMnemonicForAccount("carol", "carol words")

      expect(mockSetInternet).toHaveBeenCalledWith(
        "secure-store.blink.local/mnemonicAccounts",
        "mnemonicAccounts",
        "alice\n\u0000garbage\nbob\ncarol",
        { accessible: MNEMONIC_ACCESSIBLE },
      )
    })

    it("drops blank lines, so a stored empty value reads as no ids at all", async () => {
      mockGetInternet.mockImplementation(async (server: string) =>
        server === "secure-store.blink.local/mnemonicAccounts"
          ? { username: "mnemonicAccounts", password: "\n  \n" }
          : false,
      )

      await KeyStoreWrapper.setMnemonicForAccount("alice", "alice words")

      expect(mockSetInternet).toHaveBeenCalledWith(
        "secure-store.blink.local/mnemonicAccounts",
        "mnemonicAccounts",
        "alice",
        { accessible: MNEMONIC_ACCESSIBLE },
      )
    })

    /**
     * Earlier builds of this branch wrote the list as a JSON array. Split by
     * line that array is one id matching no account, so every real mnemonic on
     * such a device would survive a wipe that reported success.
     */
    it("reads a list an earlier build left as a JSON array", async () => {
      mockGetInternet.mockImplementation(async (server: string) =>
        server === "secure-store.blink.local/mnemonicAccounts"
          ? { username: "mnemonicAccounts", password: '["alice","bob"]' }
          : false,
      )

      await KeyStoreWrapper.setMnemonicForAccount("carol", "carol words")

      // Read as two ids, and rewritten in the format that replaced it.
      expect(mockSetInternet).toHaveBeenCalledWith(
        "secure-store.blink.local/mnemonicAccounts",
        "mnemonicAccounts",
        "alice\nbob\ncarol",
        { accessible: MNEMONIC_ACCESSIBLE },
      )
    })

    /**
     * The one case the line format cannot contain, because the damage is not
     * per line: half an array is not half a list of ids. Reading it as lines
     * would invent ids, and writing those back would make the invention
     * permanent — so it is reported unreadable and left alone.
     */
    it("leaves an unreadable array alone rather than turning it into invented ids", async () => {
      mockGetInternet.mockImplementation(async (server: string) =>
        server === "secure-store.blink.local/mnemonicAccounts"
          ? { username: "mnemonicAccounts", password: '["alice","bo' }
          : false,
      )

      await KeyStoreWrapper.setMnemonicForAccount("carol", "carol words")

      expect(mockSetInternet).not.toHaveBeenCalledWith(
        "secure-store.blink.local/mnemonicAccounts",
        "mnemonicAccounts",
        expect.anything(),
        expect.anything(),
      )
    })

    it("treats an array of anything but ids as unreadable", async () => {
      mockGetInternet.mockImplementation(async (server: string) =>
        server === "secure-store.blink.local/mnemonicAccounts"
          ? { username: "mnemonicAccounts", password: '["alice",42]' }
          : false,
      )

      await KeyStoreWrapper.setMnemonicForAccount("carol", "carol words")

      expect(mockSetInternet).not.toHaveBeenCalledWith(
        "secure-store.blink.local/mnemonicAccounts",
        "mnemonicAccounts",
        expect.anything(),
        expect.anything(),
      )
    })

    it("reports nothing when the rewrite itself fails, so the claim matches what happened", async () => {
      mockGetInternet.mockImplementation(async (server: string) =>
        server === "secure-store.blink.local/mnemonicAccounts"
          ? { username: "mnemonicAccounts", password: "not json at all" }
          : false,
      )
      mockSetInternet.mockImplementation(async (server: string) =>
        server === "secure-store.blink.local/mnemonicAccounts"
          ? false
          : { service: "mock" },
      )

      await KeyStoreWrapper.setMnemonicForAccount("alice", "alice words")

      // Nothing was lost: the damaged list is still there to be repaired by the
      // next write, so a report claiming it was rewritten would be false.
      expect(mockCrashlyticsLog).not.toHaveBeenCalledWith(
        "[defect] Mnemonic accounts list malformed; rewritten",
      )
    })

    it("reports nothing when the stored list is healthy", async () => {
      mockGetInternet.mockImplementation(async (server: string) =>
        server === "secure-store.blink.local/mnemonicAccounts"
          ? { username: "mnemonicAccounts", password: "alice" }
          : false,
      )

      await KeyStoreWrapper.setMnemonicForAccount("bob", "bob words")

      expect(mockCrashlyticsLog).not.toHaveBeenCalledWith(
        "[defect] Mnemonic accounts list malformed; rewritten",
      )
    })

    // The upgrade path: mnemonics that arrived by migration were never written
    // through here, so the sweep is the only thing that can record them.
    it("records an account whose mnemonic predates the list, through the sweep's entry point", async () => {
      await KeyStoreWrapper.rememberMnemonicAccount("alice")

      expect(mockSetInternet).toHaveBeenCalledWith(
        "secure-store.blink.local/mnemonicAccounts",
        "mnemonicAccounts",
        "alice",
        { accessible: MNEMONIC_ACCESSIBLE },
      )
    })

    it("leaves a list it could not read alone rather than replacing it", async () => {
      // Rewriting from a failed read would drop every id already tracked, and
      // the reinstall wipe would then miss the mnemonics those ids name.
      mockGetInternet.mockImplementation(async (server: string) => {
        if (server === "secure-store.blink.local/mnemonicAccounts") {
          throw new Error("keychain unavailable")
        }
        return false
      })

      await KeyStoreWrapper.setMnemonicForAccount("alice", "alice words")

      const listWrites = mockSetInternet.mock.calls.filter(
        ([server]) => server === "secure-store.blink.local/mnemonicAccounts",
      )
      expect(listWrites).toHaveLength(0)
    })

    /**
     * The inverse of what this file used to pin. Recording only after a
     * successful value write makes the list a subset of what is stored, and the
     * one id it can miss names a mnemonic the reinstall wipe can then never
     * reach. Recording first makes it a superset instead, and the extra id costs
     * one no-op delete that deleteMnemonicForAccount untracks on its way out.
     */
    it("records the account even when the mnemonic write fails, erring towards a spurious id", async () => {
      mockSetInternet.mockRejectedValue(new Error("keychain write-locked"))

      const written = await KeyStoreWrapper.setMnemonicForAccount("alice", "alice words")

      expect(written).toBe(false)
      expect(mockSetInternet).toHaveBeenCalledWith(
        "secure-store.blink.local/mnemonicAccounts",
        "mnemonicAccounts",
        "alice",
        { accessible: MNEMONIC_ACCESSIBLE },
      )
    })

    it("records the account before writing the value, so a crash between the two is survivable", async () => {
      await KeyStoreWrapper.setMnemonicForAccount("alice", "alice words")

      const servers = mockSetInternet.mock.calls.map(([server]) => server)
      expect(servers.indexOf("secure-store.blink.local/mnemonicAccounts")).toBeLessThan(
        servers.indexOf("secure-store.blink.local/mnemonic:alice"),
      )
    })

    /**
     * The caller is still told the write succeeded, because it did. What it
     * cannot see is that the wipe has no way to name the seed now stored, so the
     * report is the only trace until the boot sweep re-records it.
     */
    it("reports a mnemonic that was stored but could not be tracked", async () => {
      mockSetInternet.mockImplementation(async (server: string) =>
        server === "secure-store.blink.local/mnemonicAccounts"
          ? false
          : { service: "mock" },
      )

      const written = await KeyStoreWrapper.setMnemonicForAccount("alice", "alice words")

      expect(written).toBe(true)
      expect(mockCrashlyticsLog).toHaveBeenCalledWith(
        "[defect] Mnemonic stored but not tracked",
      )
    })

    /**
     * The report sits after the write the caller depends on, and `lifecycle.ts`
     * rolls the mnemonic back on a false answer. A firebase handle that is not
     * initialised yet must therefore not be able to reject this call, or a seed
     * that was stored fine gets orphaned under an unregistered account id.
     */
    it("still reports the write as successful when the telemetry call throws", async () => {
      mockSetInternet.mockImplementation(async (server: string) =>
        server === "secure-store.blink.local/mnemonicAccounts"
          ? false
          : { service: "mock" },
      )
      // Thrown from `log`, not from `recordError`: `recordAppError` logs a
      // breadcrumb before it records, and the record half is suppressed here by
      // the process-lifetime dedup the case above already spent. Throwing from
      // the half that always runs is what makes this case exercise anything.
      //
      // Once, not for the file: clearAllMocks resets calls but not
      // implementations, so a persistent throw would leak into every later test.
      mockCrashlyticsLog.mockImplementationOnce(() => {
        throw new Error("firebase not initialised")
      })

      const written = await KeyStoreWrapper.setMnemonicForAccount("alice", "alice words")

      expect(written).toBe(true)
    })

    it("reports nothing when the account is already tracked", async () => {
      mockGetInternet.mockImplementation(async (server: string) =>
        server === "secure-store.blink.local/mnemonicAccounts"
          ? { username: "mnemonicAccounts", password: "alice" }
          : false,
      )

      await KeyStoreWrapper.setMnemonicForAccount("alice", "alice words")

      expect(mockCrashlyticsLog).not.toHaveBeenCalledWith(
        "[defect] Mnemonic stored but not tracked",
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
          ? { username: "mnemonicAccounts", password: "alice\nbob" }
          : false,
      )

      await KeyStoreWrapper.deleteMnemonicForAccount("alice")

      expect(mockSetInternet).toHaveBeenCalledWith(
        "secure-store.blink.local/mnemonicAccounts",
        "mnemonicAccounts",
        "bob",
        { accessible: MNEMONIC_ACCESSIBLE },
      )
    })

    it("removes the tracked list entirely with the last account", async () => {
      mockGetInternet.mockImplementation(async (server: string) =>
        server === "secure-store.blink.local/mnemonicAccounts"
          ? { username: "mnemonicAccounts", password: "alice" }
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
          ? { username: "mnemonicAccounts", password: "alice" }
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

    it("drops only the id it was asked to, leaving damaged lines where they are", async () => {
      mockRemove.mockResolvedValue(undefined)
      mockGetInternet.mockImplementation(async (server: string) =>
        server === "secure-store.blink.local/mnemonicAccounts"
          ? { username: "mnemonicAccounts", password: "alice\n\u0000garbage\nbob" }
          : false,
      )

      await KeyStoreWrapper.deleteMnemonicForAccount("alice")

      // Subtracting cannot lose what it cannot read, because there is nothing
      // it cannot read: the line it does not recognise is carried through.
      expect(mockSetInternet).toHaveBeenCalledWith(
        "secure-store.blink.local/mnemonicAccounts",
        "mnemonicAccounts",
        "\u0000garbage\nbob",
        { accessible: MNEMONIC_ACCESSIBLE },
      )
    })
  })

  /**
   * The list is read, modified and written back, and that has to be one turn in
   * the slot queue rather than three unrelated calls. Two overlapping
   * transactions that both read the pre-write list both write their own version
   * of it, and whichever lands second erases the other's id — leaving a
   * mnemonic the reinstall wipe can no longer reach.
   */
  describe("tracked-list serialization", () => {
    const LIST_SERVER = "secure-store.blink.local/mnemonicAccounts"

    /**
     * A store that answers from what has actually been written to it, so a lost
     * update shows up as a missing id rather than as a call count.
     *
     * `holdRead` runs after the value has been picked up and before it is
     * handed back, which is what a slow keychain read is: it resolves with what
     * it saw when it started, not with what the store holds by then.
     */
    const backedByWrites = (
      stored: Map<string, string>,
      holdRead: (server: string) => Promise<void> = async () => {},
    ) => {
      mockSetInternet.mockImplementation(
        async (server: string, _username: string, password: string) => {
          stored.set(server, password)
          return { service: "mock" }
        },
      )
      mockResetInternet.mockImplementation(async ({ server }: { server: string }) => {
        stored.delete(server)
      })
      mockGetInternet.mockImplementation(async (server: string) => {
        const value = stored.get(server)
        await holdRead(server)
        if (value === undefined) return false
        return { username: server, password: value }
      })
    }

    /** Holds the first read of the tracked list open until it is released. */
    const holdFirstListRead = () => {
      let release = () => {}
      let reads = 0
      const hold = async (server: string) => {
        if (server !== LIST_SERVER) return
        reads += 1
        if (reads > 1) return
        await new Promise<void>((resolve) => {
          release = resolve
        })
      }
      return {
        hold,
        listReads: () => reads,
        release: () => release(),
      }
    }

    const flush = () =>
      new Promise<void>((resolve) => {
        setImmediate(resolve)
      })

    it("holds the second transaction until the first has written", async () => {
      const stored = new Map<string, string>()
      const first = holdFirstListRead()
      backedByWrites(stored, first.hold)

      const bothRecorded = Promise.all([
        KeyStoreWrapper.setMnemonicForAccount("alice", "alice words"),
        KeyStoreWrapper.setMnemonicForAccount("bob", "bob words"),
      ])

      // The second transaction has not even read the list yet: unserialized it
      // would have, and would have read it empty.
      await flush()
      expect(first.listReads()).toBe(1)

      first.release()
      await bothRecorded

      expect(stored.get(LIST_SERVER)).toBe("alice\nbob")
    })

    it("keeps both ids when two accounts are recorded at once", async () => {
      const stored = new Map<string, string>()
      backedByWrites(stored)

      await Promise.all([
        KeyStoreWrapper.setMnemonicForAccount("alice", "alice words"),
        KeyStoreWrapper.setMnemonicForAccount("bob", "bob words"),
      ])

      expect(stored.get(LIST_SERVER)).toBe("alice\nbob")
    })

    it("does not let a slow read resurrect an id another transaction dropped", async () => {
      const stored = new Map<string, string>([[LIST_SERVER, "alice"]])
      const first = holdFirstListRead()
      backedByWrites(stored, first.hold)
      mockRemove.mockResolvedValue(undefined)

      const bothDone = Promise.all([
        KeyStoreWrapper.setMnemonicForAccount("bob", "bob words"),
        KeyStoreWrapper.deleteMnemonicForAccount("alice"),
      ])

      await flush()
      first.release()
      await bothDone

      // Unserialized, the held read hands back the list as it was before the
      // delete and writes alice straight back into it.
      expect(stored.get(LIST_SERVER)).toBe("bob")
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
    mockResetGenericPassword.mockResolvedValue(true)
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
})

/**
 * The mnemonics are the reason this wipe exists at all now: the legacy
 * library's own reinstall sweep used to clear them by accident, and with every
 * slot behind the read-through helper that sweep never fires.
 *
 * Split from the session credentials because the caller runs one without the
 * other: the fresh-install verdict is a heuristic, and this half waits for the
 * account index to corroborate it.
 */
describe("KeyStoreWrapper clearUninstallSurvivingKeyMaterial", () => {
  const onFailure = jest.fn()

  afterAll(() => {
    setPlatform(ORIGINAL_PLATFORM)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    setPlatform("ios")
    mockSetInternet.mockResolvedValue({ service: "mock" })
    mockGetInternet.mockResolvedValue(false)
    mockHasInternet.mockResolvedValue(false)
    mockResetInternet.mockResolvedValue(undefined)
    mockResetGenericPassword.mockResolvedValue(true)
    mockGet.mockRejectedValue(
      Object.assign(new Error("key does not present"), { code: "404" }),
    )
    mockRemove.mockResolvedValue(undefined)
  })

  it("clears the mnemonic of every tracked account", async () => {
    mockGetInternet.mockImplementation(async (server: string) =>
      server === "secure-store.blink.local/mnemonicAccounts"
        ? { username: "mnemonicAccounts", password: "alice\nbob" }
        : false,
    )

    await KeyStoreWrapper.clearUninstallSurvivingKeyMaterial(onFailure)

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

  /**
   * The wipe is the reason the array shape is still read at all: a device that
   * ran an earlier build of this branch is exactly the device whose seeds this
   * has to reach.
   */
  it("wipes the accounts of a list an earlier build left as a JSON array", async () => {
    mockGetInternet.mockImplementation(async (server: string) =>
      server === "secure-store.blink.local/mnemonicAccounts"
        ? { username: "mnemonicAccounts", password: '["alice","bob"]' }
        : false,
    )

    await KeyStoreWrapper.clearUninstallSurvivingKeyMaterial(onFailure)

    expect(mockResetInternet).toHaveBeenCalledWith({
      server: "secure-store.blink.local/mnemonic:alice",
    })
    expect(mockResetInternet).toHaveBeenCalledWith({
      server: "secure-store.blink.local/mnemonic:bob",
    })
    expect(onFailure).not.toHaveBeenCalled()
  })

  /**
   * Reported, not guessed at: an array that will not parse names no account
   * this wipe could reach, and saying so is what keeps the erase owed for the
   * next boot instead of retiring it over untouched seeds.
   */
  it("reports an array it cannot read instead of wiping the ids it invents", async () => {
    mockGetInternet.mockImplementation(async (server: string) =>
      server === "secure-store.blink.local/mnemonicAccounts"
        ? { username: "mnemonicAccounts", password: '["alice","bo' }
        : false,
    )

    await KeyStoreWrapper.clearUninstallSurvivingKeyMaterial(onFailure)

    // Named apart from a failed read: that one clears itself on the next boot,
    // this one repeats until someone looks at the device, and a single label
    // for both would leave the eternal report looking transient.
    expect(onFailure).toHaveBeenCalledWith("mnemonic account list (unreadable value)")
    expect(mockResetInternet).not.toHaveBeenCalledWith({
      server: 'secure-store.blink.local/mnemonic:["alice","bo',
    })
  })

  it("reports the list rather than claiming a clean wipe it cannot verify", async () => {
    mockGetInternet.mockImplementation(async (server: string) => {
      if (server === "secure-store.blink.local/mnemonicAccounts") {
        throw new Error("keychain unavailable")
      }
      return false
    })

    await KeyStoreWrapper.clearUninstallSurvivingKeyMaterial(onFailure)

    expect(onFailure).toHaveBeenCalledWith("mnemonic account list")
  })

  /**
   * The wipe no longer has a "damaged list" branch to take, because the format
   * has no whole-value failure: a line it does not recognise is one spurious id,
   * which costs a no-op delete, and every real id beside it is still wiped. The
   * reportable state that remains is a list it could not read at all.
   */
  it("wipes the ids it can read, even beside a line that means nothing", async () => {
    mockGetInternet.mockImplementation(async (server: string) =>
      server === "secure-store.blink.local/mnemonicAccounts"
        ? { username: "mnemonicAccounts", password: "alice\n\u0000garbage\nbob" }
        : false,
    )

    await KeyStoreWrapper.clearUninstallSurvivingKeyMaterial(onFailure)

    expect(mockResetInternet).toHaveBeenCalledWith({
      server: "secure-store.blink.local/mnemonic:alice",
    })
    expect(mockResetInternet).toHaveBeenCalledWith({
      server: "secure-store.blink.local/mnemonic:bob",
    })
    expect(onFailure).not.toHaveBeenCalledWith("mnemonic account list")
  })

  /**
   * One label per account says nothing about how much of the device was missed,
   * and N identical entries are worse than one carrying the number. The sweep
   * reports its own failures the same way.
   */
  it("reports the share of accounts it could not clear, once, not one entry each", async () => {
    mockGetInternet.mockImplementation(async (server: string) =>
      server === "secure-store.blink.local/mnemonicAccounts"
        ? { username: "mnemonicAccounts", password: "alice\nbob" }
        : false,
    )
    mockRemove.mockRejectedValue(new Error("keystore unavailable"))
    mockResetInternet.mockRejectedValue(new Error("keystore unavailable"))

    await KeyStoreWrapper.clearUninstallSurvivingKeyMaterial(onFailure)

    const mnemonicReports = onFailure.mock.calls
      .flat()
      .filter((what: string) => String(what).startsWith("mnemonic"))
    expect(mnemonicReports).toEqual(["mnemonic (2/2)"])
  })

  it("reports nothing about mnemonics when every tracked account is cleared", async () => {
    mockGetInternet.mockImplementation(async (server: string) =>
      server === "secure-store.blink.local/mnemonicAccounts"
        ? { username: "mnemonicAccounts", password: "alice" }
        : false,
    )

    await KeyStoreWrapper.clearUninstallSurvivingKeyMaterial(onFailure)

    expect(onFailure.mock.calls.flat()).not.toContain("mnemonic (1/1)")
  })

  /**
   * Android is where the legacy-store argument is a no-op — an uninstall clears
   * app storage, and eraseEntireLegacyStore returns without touching anything —
   * so the tracked list is the only mechanism that reaches a migrated mnemonic.
   */
  it("still clears the tracked mnemonics on Android, where the legacy erase does nothing", async () => {
    setPlatform("android")
    mockGetInternet.mockImplementation(async (server: string) =>
      server === "secure-store.blink.local/mnemonicAccounts"
        ? { username: "mnemonicAccounts", password: "alice" }
        : false,
    )

    await KeyStoreWrapper.clearUninstallSurvivingKeyMaterial(onFailure)

    expect(mockResetGenericPassword).not.toHaveBeenCalled()
    expect(mockResetInternet).toHaveBeenCalledWith({
      server: "secure-store.blink.local/mnemonic:alice",
    })
  })

  /**
   * The fact that matters, which asserting the report alone never showed: after
   * the skip the mnemonic is still there. Without this, a skip that silently
   * became a delete of the wrong slot, or a loop that ran over an empty list and
   * reported success, would both keep every other case here green.
   */
  it("leaves the mnemonic readable when it skipped the loop, rather than half-wiping", async () => {
    const stored = new Map<string, string>([
      ["secure-store.blink.local/mnemonic:alice", "alice words"],
    ])
    mockGetInternet.mockImplementation(async (server: string) => {
      if (server === "secure-store.blink.local/mnemonicAccounts") {
        throw new Error("keychain unavailable")
      }
      const value = stored.get(server)
      return value === undefined ? false : { username: server, password: value }
    })
    mockResetInternet.mockImplementation(async ({ server }: { server: string }) => {
      stored.delete(server)
    })

    await KeyStoreWrapper.clearUninstallSurvivingKeyMaterial(onFailure)

    expect(onFailure).toHaveBeenCalledWith("mnemonic account list")
    expect(await KeyStoreWrapper.getMnemonicForAccount("alice")).toBe("alice words")
  })

  it("clears nothing extra when no account was ever tracked", async () => {
    await KeyStoreWrapper.clearUninstallSurvivingKeyMaterial(onFailure)

    const mnemonicResets = mockResetInternet.mock.calls.filter(([arg]) =>
      String((arg as { server: string }).server).includes("mnemonic"),
    )
    expect(mnemonicResets).toHaveLength(0)
    expect(onFailure).not.toHaveBeenCalled()
  })

  /**
   * The tracked list only names accounts a build that HAD it recorded. An
   * install predating it left mnemonics no id here can reach, and the module's
   * own reinstall sweep that used to catch them is disarmed now — so the wipe
   * clears the legacy store by service instead.
   */
})

describe("KeyStoreWrapper wipe reporting", () => {
  const onFailure = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockSetInternet.mockResolvedValue({ service: "mock" })
    mockGetInternet.mockResolvedValue(false)
    mockHasInternet.mockResolvedValue(false)
    mockResetInternet.mockResolvedValue(undefined)
    mockResetGenericPassword.mockResolvedValue(true)
  })

  it("reports every slot when the keystore is fully unavailable, and never throws", async () => {
    mockGet.mockRejectedValue(new Error("keystore unavailable"))
    mockRemove.mockRejectedValue(new Error("keystore unavailable"))
    mockResetGenericPassword.mockRejectedValue(new Error("keystore unavailable"))

    await expect(
      KeyStoreWrapper.clearUninstallSurvivingCredentials(onFailure),
    ).resolves.toBeUndefined()

    // The lockout state reports now. The wipe erases both of its keys directly
    // instead of going through clearPinFailureState, whose fallback writes a
    // zeroed value — a wipe must not end by creating an entry that then outlives
    // the next uninstall.
    expect(onFailure.mock.calls.flat()).toEqual([
      "active token",
      "session profiles",
      "pin",
      "pin lockout state",
      "legacy pin attempts",
      "biometrics flag",
    ])
  })

  it("reports the key-material slots separately, since they wipe separately", async () => {
    mockGet.mockRejectedValue(new Error("keystore unavailable"))
    mockGetInternet.mockRejectedValue(new Error("keystore unavailable"))
    mockRemove.mockRejectedValue(new Error("keystore unavailable"))
    mockResetGenericPassword.mockRejectedValue(new Error("keystore unavailable"))

    await expect(
      KeyStoreWrapper.clearUninstallSurvivingKeyMaterial(onFailure),
    ).resolves.toBeUndefined()

    // The legacy erase is its own step now, run by the caller before either
    // half, so this half reports only what it owns.
    expect(onFailure.mock.calls.flat()).toEqual(["mnemonic account list"])
  })

  it("never writes a cleared lockout state while wiping, however the erase goes", async () => {
    mockRemove.mockRejectedValue(new Error("keystore unavailable"))
    mockResetInternet.mockRejectedValue(new Error("keystore unavailable"))

    await KeyStoreWrapper.clearUninstallSurvivingCredentials(onFailure)

    // The write fallback lives in clearPinFailureState and is right for its own
    // caller; reached from here it would leave behind exactly what the wipe came
    // to remove.
    expect(mockSetInternet).not.toHaveBeenCalledWith(
      "secure-store.blink.local/pinFailureState",
      expect.anything(),
      expect.anything(),
      expect.anything(),
    )
  })
})

describe("KeyStoreWrapper clearLegacyKeyStore", () => {
  const onFailure = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    setPlatform("ios")
    mockSetInternet.mockResolvedValue({ service: "mock" })
    mockGetInternet.mockResolvedValue(false)
    mockResetInternet.mockResolvedValue(undefined)
    mockResetGenericPassword.mockResolvedValue(true)
    mockGet.mockRejectedValue(
      Object.assign(new Error("key does not present"), { code: "404" }),
    )
    mockRemove.mockResolvedValue(undefined)
  })

  const LEGACY_SERVICE = { service: "RNSecureKeyStoreKeyChain" }

  it("is erased even when no account was ever tracked", async () => {
    // The pre-tracking reinstall: nothing to enumerate, and mnemonics still
    // sitting in the legacy store.
    await KeyStoreWrapper.clearLegacyKeyStore(onFailure)

    expect(mockResetGenericPassword).toHaveBeenCalledWith(LEGACY_SERVICE)
    expect(onFailure).not.toHaveBeenCalled()
  })

  it("does not read the tracked list at all, which is why it can run first", async () => {
    await KeyStoreWrapper.clearLegacyKeyStore(onFailure)

    expect(mockGetInternet).not.toHaveBeenCalledWith(
      "secure-store.blink.local/mnemonicAccounts",
    )
    expect(mockResetGenericPassword).toHaveBeenCalledWith(LEGACY_SERVICE)
  })

  /**
   * Why the order above is the one that matters. `removeThrough` refuses to
   * empty the new store until the legacy copy is provably gone, so a legacy
   * store that will not erase fails every per-account delete. Erasing it
   * wholesale first is what lets those deletes finish on the same boot, rather
   * than arriving after the loop it would have unblocked.
   */
  it("clears the way for a per-account delete that a stubborn legacy copy would block", async () => {
    mockGetInternet.mockImplementation(async (server: string) =>
      server === "secure-store.blink.local/mnemonicAccounts"
        ? { username: "mnemonicAccounts", password: "alice" }
        : false,
    )
    // The per-key erase never works; only the service-wide reset does.
    mockRemove.mockRejectedValue(new Error("legacy erase refused"))
    let legacyStoreEmptied = false
    mockResetGenericPassword.mockImplementation(async () => {
      legacyStoreEmptied = true
      return true
    })
    mockGet.mockImplementation(async () => {
      if (legacyStoreEmptied) {
        throw Object.assign(new Error("key does not present"), { code: "404" })
      }
      return "alice words"
    })

    await KeyStoreWrapper.clearLegacyKeyStore(onFailure)
    await KeyStoreWrapper.clearUninstallSurvivingKeyMaterial(onFailure)

    expect(onFailure).not.toHaveBeenCalledWith("mnemonic")
    expect(mockResetInternet).toHaveBeenCalledWith({
      server: "secure-store.blink.local/mnemonic:alice",
    })
  })

  it("reports a failed erase by name and never throws", async () => {
    mockResetGenericPassword.mockResolvedValue(false)

    await expect(KeyStoreWrapper.clearLegacyKeyStore(onFailure)).resolves.toBeUndefined()

    expect(onFailure).toHaveBeenCalledWith("legacy key store")
  })

  it("gets the same single retry as every other slot", async () => {
    mockResetGenericPassword.mockResolvedValueOnce(false).mockResolvedValue(true)

    await KeyStoreWrapper.clearLegacyKeyStore(onFailure)

    expect(mockResetGenericPassword).toHaveBeenCalledTimes(2)
    expect(onFailure).not.toHaveBeenCalled()
  })

  it("never touches the new store, whose items it cannot match anyway", async () => {
    await KeyStoreWrapper.clearLegacyKeyStore(onFailure)

    // Internet credentials are a different item class: a generic-password
    // delete cannot reach them, and this asserts the wipe does not try.
    expect(mockResetGenericPassword).not.toHaveBeenCalledWith(
      expect.objectContaining({ server: expect.anything() }),
    )
  })
})

describe("KeyStoreWrapper.purgeLegacyKeyStore", () => {
  /** Every key the purge is expected to name, in the order it names them. */
  const FIXED_KEYS = [
    "isBiometricsEnabled",
    "PIN",
    "pinFailureState",
    "pinAttempts",
    "sessionProfiles",
    "galoyAuthToken",
  ]

  /**
   * Both stores, so that a purge which migrates before erasing is exercised the
   * way it runs: the legacy value moves across and the new store then answers
   * for it.
   */
  const stores = {
    legacy: new Map<string, string>(),
    migrated: new Map<string, string>(),
  }

  const legacyNotFound = () =>
    Object.assign(new Error("key does not present"), { code: "404" })

  beforeEach(() => {
    jest.clearAllMocks()
    stores.legacy.clear()
    stores.migrated.clear()

    mockGet.mockImplementation(async (key: string) => {
      const value = stores.legacy.get(key)
      if (value === undefined) throw legacyNotFound()
      return value
    })
    mockRemove.mockImplementation(async (key: string) => {
      stores.legacy.delete(key)
    })
    mockGetInternet.mockImplementation(async (server: string) => {
      const slot = server.replace("secure-store.blink.local/", "")
      const value = stores.migrated.get(slot)
      if (value === undefined) return false
      return { username: slot, password: value }
    })
    mockSetInternet.mockImplementation(
      async (server: string, slot: string, value: string) => {
        stores.migrated.set(slot, value)
        return { service: server }
      },
    )
    mockResetInternet.mockResolvedValue(undefined)
  })

  it("erases the six fixed keys", async () => {
    FIXED_KEYS.forEach((key) => stores.legacy.set(key, `${key}-value`))

    const purged = await KeyStoreWrapper.purgeLegacyKeyStore([])

    expect(purged).toBe(true)
    expect([...stores.legacy.keys()]).toEqual([])
  })

  it("erases both mnemonic keys for every account it is given", async () => {
    stores.legacy.set("mnemonic:alice", "alpha beta")
    stores.legacy.set("mnemonic_network:alice", "bitcoin")

    const purged = await KeyStoreWrapper.purgeLegacyKeyStore(["alice"])

    expect(purged).toBe(true)
    expect([...stores.legacy.keys()]).toEqual([])
  })

  it("moves a value to the new store before erasing it", async () => {
    stores.legacy.set("mnemonic:alice", "alpha beta")

    await KeyStoreWrapper.purgeLegacyKeyStore(["alice"])

    expect(stores.migrated.get("mnemonic:alice")).toBe("alpha beta")
  })

  it("counts a key that was never there as gone", async () => {
    const purged = await KeyStoreWrapper.purgeLegacyKeyStore([])

    expect(purged).toBe(true)
    expect(mockRemove).not.toHaveBeenCalled()
  })

  /**
   * The failure this whole ordering exists for: a read-through answers `found`
   * from the legacy store even when the migrating write failed, so erasing on
   * that answer would delete the only copy of someone's seed.
   */
  it("keeps the legacy copy when the migrating write failed", async () => {
    stores.legacy.set("mnemonic:alice", "alpha beta")
    mockSetInternet.mockResolvedValue(false)

    const purged = await KeyStoreWrapper.purgeLegacyKeyStore(["alice"])

    expect(purged).toBe(false)
    expect(stores.legacy.get("mnemonic:alice")).toBe("alpha beta")
  })

  it("keeps the legacy copy when the new store cannot be read back", async () => {
    stores.legacy.set("PIN", "1234")
    mockGetInternet.mockRejectedValue(new Error("keychain unavailable"))

    const purged = await KeyStoreWrapper.purgeLegacyKeyStore([])

    expect(purged).toBe(false)
    expect(stores.legacy.get("PIN")).toBe("1234")
  })

  it("keeps going when the legacy store cannot say what it holds", async () => {
    mockGet.mockRejectedValue(new Error("keychain unavailable"))

    const purged = await KeyStoreWrapper.purgeLegacyKeyStore([])

    expect(purged).toBe(false)
    expect(mockRemove).not.toHaveBeenCalled()
  })

  /**
   * The iOS module returns nil for any failed lookup and rejects it with the
   * not-found code, so a read taken before first unlock reports an empty store
   * rather than an unreadable one. Believing it would record the purge as done
   * over a seed that never left the legacy store.
   */
  it("does not call a mnemonic purged on an empty legacy read alone", async () => {
    const purged = await KeyStoreWrapper.purgeLegacyKeyStore(["alice"])

    expect(purged).toBe(false)
  })

  it("calls a mnemonic purged once the new store holds it", async () => {
    stores.migrated.set("mnemonic:alice", "alpha beta")
    stores.migrated.set("mnemonic_network:alice", "bitcoin")

    const purged = await KeyStoreWrapper.purgeLegacyKeyStore(["alice"])

    expect(purged).toBe(true)
  })

  /**
   * The marker is optional metadata, so demanding proof of it would leave the
   * purge unable to finish for an account that never had one.
   */
  it("completes for an account with a seed but no network marker", async () => {
    stores.migrated.set("mnemonic:alice", "alpha beta")

    const purged = await KeyStoreWrapper.purgeLegacyKeyStore(["alice"])

    expect(purged).toBe(true)
  })

  /** A user who never set a PIN has nothing here and must not be retried forever. */
  it("accepts an empty legacy read for the session slots", async () => {
    const purged = await KeyStoreWrapper.purgeLegacyKeyStore([])

    expect(purged).toBe(true)
  })

  it("still purges every remaining slot after one of them fails", async () => {
    FIXED_KEYS.forEach((key) => stores.legacy.set(key, `${key}-value`))
    stores.legacy.set("mnemonic:alice", "alpha beta")
    mockRemove.mockImplementation(async (key: string) => {
      if (key === "PIN") throw new Error("keychain unavailable")
      stores.legacy.delete(key)
    })

    const purged = await KeyStoreWrapper.purgeLegacyKeyStore(["alice"])

    expect(purged).toBe(false)
    expect([...stores.legacy.keys()]).toEqual(["PIN"])
  })

  /**
   * The timeout only races a hung native call, it cannot cancel it. So the
   * verify can still be running when its slot is handed on, and the erase that
   * follows would then be deleting a legacy copy on behalf of a slot that has
   * moved on.
   */
  it("drops the erase of a verify that lands after its slot moved on", async () => {
    jest.useFakeTimers()
    stores.legacy.set("PIN", "1234")
    stores.migrated.set("PIN", "1234")

    // The verify is the SECOND read of this slot: the read-through ahead of it
    // does the first, and only the verify may be left holding a stale slot.
    let releaseHungVerify: () => void = () => {}
    let pinReads = 0
    mockGetInternet.mockImplementation(async (server: string) => {
      const slot = server.replace("secure-store.blink.local/", "")
      if (slot === "PIN") {
        pinReads += 1
        if (pinReads === 2) {
          return new Promise((resolve) => {
            releaseHungVerify = () => resolve({ username: "PIN", password: "1234" })
          })
        }
      }
      const value = stores.migrated.get(slot)
      if (value === undefined) return false
      return { username: slot, password: value }
    })

    const purged = KeyStoreWrapper.purgeLegacyKeyStore([])
    await jest.advanceTimersByTimeAsync(30_000)
    expect(await purged).toBe(false)

    mockRemove.mockClear()
    releaseHungVerify()
    await jest.advanceTimersByTimeAsync(0)

    expect(mockRemove).not.toHaveBeenCalled()
    jest.useRealTimers()
  })
})
