const mockGetItem = jest.fn()
const mockSetItem = jest.fn()
const mockGetMnemonicForAccount = jest.fn()
const mockReadMnemonicWithStatus = jest.fn()
const mockGetMnemonicNetworkForAccount = jest.fn()
const mockRememberMnemonicAccount = jest.fn()
const mockMnemonicExists = jest.fn()
const mockMnemonicNetworkExists = jest.fn()
const mockMnemonicIsMigrated = jest.fn()

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
  },
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getMnemonicForAccount: (...args: unknown[]) => mockGetMnemonicForAccount(...args),
    readMnemonicWithStatus: (...args: unknown[]) => mockReadMnemonicWithStatus(...args),
    getMnemonicNetworkForAccount: (...args: unknown[]) =>
      mockGetMnemonicNetworkForAccount(...args),
    rememberMnemonicAccount: (...args: unknown[]) => mockRememberMnemonicAccount(...args),
    mnemonicExists: (...args: unknown[]) => mockMnemonicExists(...args),
    mnemonicNetworkExists: (...args: unknown[]) => mockMnemonicNetworkExists(...args),
    mnemonicIsMigrated: (...args: unknown[]) => mockMnemonicIsMigrated(...args),
  },
}))

const mockRecordError = jest.fn()
const mockCrashlyticsLog = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
  log: (...args: unknown[]) => mockCrashlyticsLog(...args),
}))

import {
  addSelfCustodialAccountId,
  findSelfCustodialAccountByMnemonic,
  listSelfCustodialAccounts,
  StorageReadStatus,
  removeSelfCustodialAccountId,
  setSelfCustodialLightningAddress,
  readSelfCustodialIndexPresence,
  SelfCustodialIndexPresence,
  sweepMnemonicMigration,
  type SelfCustodialAccountEntry,
} from "@app/self-custodial/storage/account-index"

const ACCOUNT_INDEX_KEY = "selfCustodialAccountIndex"
const LEGACY_ID_LIST_KEY = "selfCustodialAccountIds"

const setIndex = (entries: SelfCustodialAccountEntry[]) => {
  mockGetItem.mockImplementation((key: string) =>
    key === ACCOUNT_INDEX_KEY
      ? Promise.resolve(JSON.stringify(entries))
      : Promise.resolve(null),
  )
}

const setLegacyOnly = (ids: string[]) => {
  mockGetItem.mockImplementation((key: string) => {
    if (key === ACCOUNT_INDEX_KEY) return Promise.resolve(null)
    if (key === LEGACY_ID_LIST_KEY) return Promise.resolve(JSON.stringify(ids))
    return Promise.resolve(null)
  })
}

describe("self-custodial account-index", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSetItem.mockResolvedValue(undefined)
    mockGetItem.mockResolvedValue(null)
    mockReadMnemonicWithStatus.mockResolvedValue({ status: "absent" })
    mockGetMnemonicNetworkForAccount.mockResolvedValue(null)
    mockRememberMnemonicAccount.mockResolvedValue(true)
    mockMnemonicExists.mockResolvedValue({ status: "no" })
    mockMnemonicNetworkExists.mockResolvedValue({ status: "no" })
    mockMnemonicIsMigrated.mockResolvedValue({ status: "yes" })
  })

  describe("listSelfCustodialAccounts", () => {
    it("returns ok with parsed entries from the canonical index", async () => {
      setIndex([
        { id: "a1", lightningAddress: null },
        { id: "a2", lightningAddress: "alice@blink.sv" },
      ])

      const result = await listSelfCustodialAccounts()

      expect(result).toEqual({
        status: StorageReadStatus.Ok,
        entries: [
          { id: "a1", lightningAddress: null },
          { id: "a2", lightningAddress: "alice@blink.sv" },
        ],
      })
    })

    it("filters out malformed entries", async () => {
      mockGetItem.mockResolvedValueOnce(
        JSON.stringify([
          { id: "a1", lightningAddress: null },
          { id: 42 }, // bad id type
          { lightningAddress: "x" }, // missing id
          { id: "a2", lightningAddress: "alice" },
        ]),
      )

      const result = await listSelfCustodialAccounts()

      expect(result.status).toBe(StorageReadStatus.Ok)
      if (result.status === StorageReadStatus.Ok) {
        expect(result.entries).toEqual([
          { id: "a1", lightningAddress: null },
          { id: "a2", lightningAddress: "alice" },
        ])
      }
    })

    it("migrates legacy id-only list and persists the canonical index", async () => {
      setLegacyOnly(["legacy-a", "legacy-b"])

      const result = await listSelfCustodialAccounts()

      expect(result).toEqual({
        status: StorageReadStatus.Ok,
        entries: [
          { id: "legacy-a", lightningAddress: null },
          { id: "legacy-b", lightningAddress: null },
        ],
      })
      expect(mockSetItem).toHaveBeenCalledWith(
        ACCOUNT_INDEX_KEY,
        JSON.stringify([
          { id: "legacy-a", lightningAddress: null },
          { id: "legacy-b", lightningAddress: null },
        ]),
      )
    })

    it("ignores non-string entries from the legacy list", async () => {
      setLegacyOnly(["legacy-a", 99, null, "legacy-b"] as never)

      const result = await listSelfCustodialAccounts()

      expect(result.status).toBe(StorageReadStatus.Ok)
      if (result.status === StorageReadStatus.Ok) {
        expect(result.entries.map((e) => e.id)).toEqual(["legacy-a", "legacy-b"])
      }
    })
  })

  describe("listSelfCustodialAccounts — read failure", () => {
    it("returns read-failed and reports to crashlytics when AsyncStorage rejects", async () => {
      // Transport-shaped message on purpose: alwaysRecord must keep storage
      // read failures recorded even when they look like connectivity blips.
      const storageError = new Error("AsyncStorage read timed out")
      mockGetItem.mockRejectedValueOnce(storageError)

      const result = await listSelfCustodialAccounts()

      expect(result).toEqual({
        status: StorageReadStatus.ReadFailed,
        error: storageError,
      })
      expect(mockRecordError).toHaveBeenCalledTimes(1)
      expect(mockRecordError.mock.calls[0][0]).toBe(storageError)
    })

    it("returns read-failed and reports to crashlytics when JSON.parse throws on the canonical key", async () => {
      mockGetItem.mockResolvedValueOnce("not-json")

      const result = await listSelfCustodialAccounts()

      expect(result.status).toBe(StorageReadStatus.ReadFailed)
      if (result.status === StorageReadStatus.ReadFailed) {
        expect(result.error).toBeInstanceOf(Error)
      }
      expect(mockRecordError).toHaveBeenCalledTimes(1)
    })

    it("wraps a non-Error rejection (string) into an Error and reports it", async () => {
      // eslint-disable-next-line prefer-promise-reject-errors
      mockGetItem.mockImplementationOnce(() => Promise.reject("boom"))

      const result = await listSelfCustodialAccounts()

      expect(result.status).toBe(StorageReadStatus.ReadFailed)
      if (result.status === StorageReadStatus.ReadFailed) {
        expect(result.error).toBeInstanceOf(Error)
        expect(result.error.message).toContain("boom")
      }
      expect(mockRecordError).toHaveBeenCalledTimes(1)
    })
  })

  describe("addSelfCustodialAccountId", () => {
    it("appends a new entry with null lightningAddress", async () => {
      setIndex([{ id: "existing", lightningAddress: null }])

      await addSelfCustodialAccountId("new-id")

      expect(mockSetItem).toHaveBeenCalledWith(
        ACCOUNT_INDEX_KEY,
        JSON.stringify([
          { id: "existing", lightningAddress: null },
          { id: "new-id", lightningAddress: null },
        ]),
      )
    })

    it("is a no-op when the id already exists", async () => {
      setIndex([{ id: "dup", lightningAddress: null }])

      await addSelfCustodialAccountId("dup")

      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it("does NOT write (preserving the registry) when the underlying read fails", async () => {
      mockGetItem.mockRejectedValueOnce(new Error("AsyncStorage unavailable"))

      await addSelfCustodialAccountId("new-id")

      expect(mockSetItem).not.toHaveBeenCalled()
      expect(mockRecordError).toHaveBeenCalledTimes(1)
    })
  })

  describe("removeSelfCustodialAccountId", () => {
    it("filters out the matching id", async () => {
      setIndex([
        { id: "a1", lightningAddress: null },
        { id: "a2", lightningAddress: null },
      ])

      await removeSelfCustodialAccountId("a1")

      expect(mockSetItem).toHaveBeenCalledWith(
        ACCOUNT_INDEX_KEY,
        JSON.stringify([{ id: "a2", lightningAddress: null }]),
      )
    })

    it("is a no-op when the id is absent", async () => {
      setIndex([{ id: "a1", lightningAddress: null }])

      await removeSelfCustodialAccountId("missing")

      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it("does NOT write (preserving the registry) when the underlying read fails", async () => {
      mockGetItem.mockRejectedValueOnce(new Error("AsyncStorage unavailable"))

      await removeSelfCustodialAccountId("a1")

      expect(mockSetItem).not.toHaveBeenCalled()
      expect(mockRecordError).toHaveBeenCalledTimes(1)
    })
  })

  describe("setSelfCustodialLightningAddress", () => {
    it("writes the lightning address for a known account", async () => {
      setIndex([{ id: "a1", lightningAddress: null }])

      await setSelfCustodialLightningAddress("a1", "alice@blink.sv")

      expect(mockSetItem).toHaveBeenCalledWith(
        ACCOUNT_INDEX_KEY,
        JSON.stringify([{ id: "a1", lightningAddress: "alice@blink.sv" }]),
      )
    })

    it("is a no-op when the account is unknown", async () => {
      setIndex([{ id: "a1", lightningAddress: null }])

      await setSelfCustodialLightningAddress("missing", "x@y")

      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it("is a no-op when the address is unchanged", async () => {
      setIndex([{ id: "a1", lightningAddress: "alice@blink.sv" }])

      await setSelfCustodialLightningAddress("a1", "alice@blink.sv")

      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it("clears the address by setting null", async () => {
      setIndex([{ id: "a1", lightningAddress: "alice@blink.sv" }])

      await setSelfCustodialLightningAddress("a1", null)

      expect(mockSetItem).toHaveBeenCalledWith(
        ACCOUNT_INDEX_KEY,
        JSON.stringify([{ id: "a1", lightningAddress: null }]),
      )
    })

    it("does NOT write (preserving the registry) when the underlying read fails", async () => {
      mockGetItem.mockRejectedValueOnce(new Error("AsyncStorage unavailable"))

      await setSelfCustodialLightningAddress("a1", "alice@blink.sv")

      expect(mockSetItem).not.toHaveBeenCalled()
      expect(mockRecordError).toHaveBeenCalledTimes(1)
    })
  })

  describe("findSelfCustodialAccountByMnemonic", () => {
    const STORED = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu"

    beforeEach(() => {
      setIndex([
        { id: "a1", lightningAddress: null },
        { id: "a2", lightningAddress: null },
      ])
    })

    it("returns ok with the matching id on exact whitespace", async () => {
      mockReadMnemonicWithStatus.mockImplementation((id: string) =>
        Promise.resolve({ status: "found", value: id === "a2" ? STORED : "other words" }),
      )

      const result = await findSelfCustodialAccountByMnemonic(STORED)

      expect(result).toEqual({
        status: StorageReadStatus.Ok,
        id: "a2",
      })
    })

    it("matches on input with leading and trailing whitespace", async () => {
      mockReadMnemonicWithStatus.mockImplementation((id: string) =>
        Promise.resolve({ status: "found", value: id === "a2" ? STORED : "other words" }),
      )

      const result = await findSelfCustodialAccountByMnemonic(`  ${STORED}  `)

      expect(result).toEqual({
        status: StorageReadStatus.Ok,
        id: "a2",
      })
    })

    it("matches on input with collapsed-runs of internal whitespace (tabs, multi-space)", async () => {
      mockReadMnemonicWithStatus.mockImplementation((id: string) =>
        Promise.resolve({ status: "found", value: id === "a2" ? STORED : "other words" }),
      )

      const noisy = STORED.replace(/ /g, "  \t  ")
      const result = await findSelfCustodialAccountByMnemonic(noisy)

      expect(result).toEqual({
        status: StorageReadStatus.Ok,
        id: "a2",
      })
    })

    it("matches when the stored value itself has noisy whitespace (legacy data)", async () => {
      const storedNoisy = `\t\t${STORED.replace(/ /g, "    ")}\n`
      mockReadMnemonicWithStatus.mockImplementation((id: string) =>
        Promise.resolve({
          status: "found",
          value: id === "a2" ? storedNoisy : "other words",
        }),
      )

      const result = await findSelfCustodialAccountByMnemonic(STORED)

      expect(result).toEqual({
        status: StorageReadStatus.Ok,
        id: "a2",
      })
    })

    it("returns ok with id=null when no entry has the matching mnemonic", async () => {
      mockReadMnemonicWithStatus.mockResolvedValue({
        status: "found",
        value: "totally different words",
      })

      const result = await findSelfCustodialAccountByMnemonic(STORED)

      expect(result).toEqual({
        status: StorageReadStatus.Ok,
        id: null,
      })
    })

    it("returns ok with id=null when an entry has no stored mnemonic", async () => {
      mockReadMnemonicWithStatus.mockResolvedValue({ status: "absent" })

      const result = await findSelfCustodialAccountByMnemonic(STORED)

      expect(result).toEqual({
        status: StorageReadStatus.Ok,
        id: null,
      })
    })

    it("returns read-failed when the underlying index read fails — never silently 'no match'", async () => {
      mockGetItem.mockRejectedValueOnce(new Error("AsyncStorage unavailable"))

      const result = await findSelfCustodialAccountByMnemonic(STORED)

      expect(result.status).toBe(StorageReadStatus.ReadFailed)
      if (result.status === StorageReadStatus.ReadFailed) {
        expect(result.error).toBeInstanceOf(Error)
        expect(result.error.message).toContain("AsyncStorage unavailable")
      }
      expect(mockRecordError).toHaveBeenCalledTimes(1)
      expect(mockReadMnemonicWithStatus).not.toHaveBeenCalled()
    })

    /**
     * The inverse of what this file used to pin. Ending the scan on the first
     * unreadable entry made one damaged slot fail every restore on the device,
     * including a phrase belonging to an account further down the list. The
     * count is what keeps "no match" honest: it says the answer covers only the
     * entries that answered.
     */
    it("carries on past an entry it cannot read, so a readable match still wins", async () => {
      mockReadMnemonicWithStatus.mockImplementation((id: string) =>
        id === "a1"
          ? Promise.resolve({ status: "failed", err: new Error("keystore unavailable") })
          : Promise.resolve({ status: "found", value: STORED }),
      )

      const result = await findSelfCustodialAccountByMnemonic(STORED)

      expect(result).toEqual({ status: StorageReadStatus.Ok, id: "a2" })
    })

    it("answers no-match with the count when nothing readable matched", async () => {
      mockReadMnemonicWithStatus.mockResolvedValue({
        status: "failed",
        err: new Error("keystore unavailable"),
      })

      const result = await findSelfCustodialAccountByMnemonic(STORED)

      // Not read-failed: the caller can still offer the restore, and a duplicate
      // account is removable where a blocked restore is not.
      expect(result).toEqual({ status: StorageReadStatus.Ok, id: null })
      expect(mockRecordError.mock.calls[0][0]).toMatchObject({
        message: "Mnemonic lookup incomplete: 2/2",
      })
    })

    it("reports nothing when every entry answered", async () => {
      mockReadMnemonicWithStatus.mockResolvedValue({
        status: "found",
        value: "totally different words",
      })

      await findSelfCustodialAccountByMnemonic(STORED)

      expect(mockRecordError).not.toHaveBeenCalled()
    })
  })

  describe("readSelfCustodialIndexPresence", () => {
    /**
     * The reinstall wipe gates the mnemonic erase on this, so "read as empty"
     * must never pass for "absent": readIndex degrades a stored value it cannot
     * recognise to zero entries, and that would be a corrupted index
     * authorising the one erase that cannot be undone.
     */
    it("is absent only when neither index key is stored", async () => {
      expect(await readSelfCustodialIndexPresence()).toBe(
        SelfCustodialIndexPresence.Absent,
      )
    })

    it("is present when the canonical index is stored, however it parses", async () => {
      mockGetItem.mockImplementation((key: string) =>
        key === ACCOUNT_INDEX_KEY
          ? Promise.resolve('{"not":"a list"}')
          : Promise.resolve(null),
      )

      expect(await readSelfCustodialIndexPresence()).toBe(
        SelfCustodialIndexPresence.Present,
      )
    })

    it("is present when only the legacy id list is stored", async () => {
      setLegacyOnly(["a1"])

      expect(await readSelfCustodialIndexPresence()).toBe(
        SelfCustodialIndexPresence.Present,
      )
    })

    /**
     * Kept apart from "present" because only this one leaves the wipe owed: the
     * caller holds the blob back on it, so the next boot asks again.
     */
    it("is unknown when the read itself fails, which proves nothing either way", async () => {
      mockGetItem.mockRejectedValue(new Error("AsyncStorage unavailable"))

      expect(await readSelfCustodialIndexPresence()).toBe(
        SelfCustodialIndexPresence.Unknown,
      )
    })
  })

  describe("sweepMnemonicMigration", () => {
    it("reads every account in the index, so an unopened one still migrates", async () => {
      setIndex([
        { id: "a1", lightningAddress: null },
        { id: "a2", lightningAddress: null },
      ])
      mockMnemonicExists.mockResolvedValue({ status: "yes" })

      const result = await sweepMnemonicMigration()

      expect(result).toEqual({ status: "ok", migrated: 2 })
      expect(mockMnemonicExists).toHaveBeenCalledWith("a1")
      expect(mockMnemonicExists).toHaveBeenCalledWith("a2")
      // The network marker migrates on the same pass.
      expect(mockMnemonicNetworkExists).toHaveBeenCalledWith("a1")
      expect(mockMnemonicNetworkExists).toHaveBeenCalledWith("a2")
      // An upgrading install records its accounts here or nowhere: the wipe
      // has no other way to learn about a mnemonic it never wrote.
      expect(mockRememberMnemonicAccount).toHaveBeenCalledWith("a1")
      expect(mockRememberMnemonicAccount).toHaveBeenCalledWith("a2")
    })

    /**
     * First case in this file to reach the sweep's dedup key, which is what lets
     * it assert the non-fatal at all: `recordAppError` suppresses a repeated key
     * for the lifetime of the process, and the module-level set it keeps is
     * shared by every test here.
     */
    it("carries on past the accounts it cannot read, and reports the sweep once with the share left behind", async () => {
      setIndex([
        { id: "a1", lightningAddress: null },
        { id: "a2", lightningAddress: null },
        { id: "a3", lightningAddress: null },
      ])
      mockMnemonicExists.mockImplementation((id: string) =>
        id === "a2"
          ? Promise.resolve({ status: "yes" })
          : Promise.resolve({ status: "failed", err: new Error("locked") }),
      )

      const result = await sweepMnemonicMigration()

      expect(result).toEqual({ status: "incomplete", failures: 2 })
      // The account behind the failures is still swept.
      expect(mockMnemonicExists).toHaveBeenCalledWith("a2")
      // The unreadable ones are never recorded: the wipe must not be pointed at
      // a slot nothing confirmed.
      expect(mockRememberMnemonicAccount).not.toHaveBeenCalledWith("a1")
      expect(mockRememberMnemonicAccount).not.toHaveBeenCalledWith("a3")

      // One non-fatal for the sweep, not one per account, and it carries how
      // much of the index was left behind rather than just that something was.
      expect(mockRecordError).toHaveBeenCalledTimes(1)
      expect(mockRecordError.mock.calls[0][0]).toMatchObject({
        message: "Mnemonic sweep incomplete: 2/3",
      })
    })

    it("keeps each failure's cause as a breadcrumb rather than its own non-fatal", async () => {
      setIndex([
        { id: "a1", lightningAddress: null },
        { id: "a2", lightningAddress: null },
      ])
      mockMnemonicExists.mockResolvedValue({
        status: "failed",
        err: new Error("keychain locked"),
      })

      await sweepMnemonicMigration()

      // "expected" is the class that logs without recording, so the reason each
      // account failed survives for whoever opens the summary non-fatal.
      const breadcrumbs = mockCrashlyticsLog.mock.calls.map(([line]) => line)
      // Counted rather than matched: arrayContaining is satisfied by a single
      // occurrence, which would pass even if only one of the two failures left
      // a trace.
      expect(
        breadcrumbs.filter((line) => line === "[expected] keychain locked"),
      ).toHaveLength(2)
      expect(breadcrumbs).toContain("[defect] Mnemonic sweep incomplete: 2/2")
    })

    it("wraps a non-Error read failure so the breadcrumb still names it", async () => {
      setIndex([{ id: "a1", lightningAddress: null }])
      mockMnemonicExists.mockResolvedValue({ status: "failed", err: "-25308" })

      const result = await sweepMnemonicMigration()

      expect(result).toEqual({ status: "incomplete", failures: 1 })
      expect(mockCrashlyticsLog.mock.calls.map(([line]) => line)).toContain(
        "[expected] Mnemonic sweep probe failed: -25308",
      )
    })

    it("raises no non-fatal when every account migrates", async () => {
      setIndex([{ id: "a1", lightningAddress: null }])
      mockMnemonicExists.mockResolvedValue({ status: "yes" })

      const result = await sweepMnemonicMigration()

      expect(result).toEqual({ status: "ok", migrated: 1 })
      expect(mockRecordError).not.toHaveBeenCalled()
      expect(mockCrashlyticsLog).not.toHaveBeenCalled()
    })

    it("passes over an account that has no mnemonic without counting or recording it", async () => {
      setIndex([
        { id: "a1", lightningAddress: null },
        { id: "a2", lightningAddress: null },
      ])
      mockMnemonicExists.mockImplementation((id: string) =>
        id === "a1"
          ? Promise.resolve({ status: "no" })
          : Promise.resolve({ status: "yes" }),
      )

      const result = await sweepMnemonicMigration()

      // Listed but seedless is a real state, reachable through a create that
      // rolled back after addSelfCustodialAccountId. It is not a failure, and
      // recording it would point the wipe at a slot that was never written.
      expect(result).toEqual({ status: "ok", migrated: 1 })
      expect(mockRememberMnemonicAccount).not.toHaveBeenCalledWith("a1")
      expect(mockRememberMnemonicAccount).toHaveBeenCalledWith("a2")
      // The network marker still rides along on the same pass.
      expect(mockMnemonicNetworkExists).toHaveBeenCalledWith("a1")
    })

    /**
     * The reason the sweep probes instead of reading. A read answers by putting
     * the phrase into a JS string, which cannot be zeroed, for every indexed
     * account on every launch — including accounts the user never opens.
     */
    it("never decrypts a mnemonic it is only counting", async () => {
      setIndex([
        { id: "a1", lightningAddress: null },
        { id: "a2", lightningAddress: null },
      ])
      mockMnemonicExists.mockResolvedValue({ status: "yes" })

      await sweepMnemonicMigration()

      expect(mockReadMnemonicWithStatus).not.toHaveBeenCalled()
      expect(mockGetMnemonicForAccount).not.toHaveBeenCalled()
      expect(mockGetMnemonicNetworkForAccount).not.toHaveBeenCalled()
    })

    /**
     * A record that does not land is a failure of the sweep, not a migration:
     * the seed is in the new store and the reinstall wipe has no way to name it,
     * which is the whole reason this runs.
     */
    it("counts an account it could not record as a failure, not a migration", async () => {
      setIndex([{ id: "a1", lightningAddress: null }])
      mockMnemonicExists.mockResolvedValue({ status: "yes" })
      mockRememberMnemonicAccount.mockResolvedValue(false)

      const result = await sweepMnemonicMigration()

      expect(result).toEqual({ status: "incomplete", failures: 1 })
    })

    /**
     * The count that gates dropping the legacy store. The probe answers yes for
     * a value it read out of the legacy store even when the write meant to move
     * it failed, so a device whose keychain refuses every write would otherwise
     * report a finished migration over seeds that never moved.
     */
    it("counts a seed the probe found but the migrating write never moved as a failure", async () => {
      setIndex([{ id: "a1", lightningAddress: null }])
      mockMnemonicExists.mockResolvedValue({ status: "yes" })
      mockMnemonicIsMigrated.mockResolvedValue({ status: "no" })

      const result = await sweepMnemonicMigration()

      expect(result).toEqual({ status: "incomplete", failures: 1 })
      expect(mockRememberMnemonicAccount).not.toHaveBeenCalled()
    })

    it("counts one that did reach the new store as migrated", async () => {
      setIndex([{ id: "a1", lightningAddress: null }])
      mockMnemonicExists.mockResolvedValue({ status: "yes" })

      const result = await sweepMnemonicMigration()

      expect(result).toEqual({ status: "ok", migrated: 1 })
      expect(mockRememberMnemonicAccount).toHaveBeenCalledWith("a1")
    })

    it("is a no-op on a fresh install", async () => {
      const result = await sweepMnemonicMigration()

      expect(result).toEqual({ status: "ok", migrated: 0 })
      expect(mockMnemonicExists).not.toHaveBeenCalled()
    })

    it("reports incomplete when the index itself cannot be read", async () => {
      mockGetItem.mockRejectedValueOnce(new Error("AsyncStorage unavailable"))

      const result = await sweepMnemonicMigration()

      expect(result).toEqual({ status: "incomplete", failures: 0 })
      expect(mockMnemonicExists).not.toHaveBeenCalled()
    })

    /**
     * The result being stable is not the same as the work being done. Re-record
     * calls are by design — they are what repairs a tracking write that failed —
     * but nothing else should recur: the index is not rewritten, and the
     * re-record is one call per account rather than a growing number. That the
     * re-record is itself a keychain no-op once the id is already tracked is
     * pinned in the store's own spec, which is where the write lives.
     */
    it("rewrites nothing on a second run over an index that has already migrated", async () => {
      setIndex([
        { id: "a1", lightningAddress: null },
        { id: "a2", lightningAddress: null },
      ])
      mockMnemonicExists.mockResolvedValue({ status: "yes" })

      await sweepMnemonicMigration()
      mockSetItem.mockClear()
      mockRememberMnemonicAccount.mockClear()

      await sweepMnemonicMigration()

      expect(mockSetItem).not.toHaveBeenCalled()
      // One per account, not a number that grows with the boot count.
      expect(mockRememberMnemonicAccount).toHaveBeenCalledTimes(2)
    })

    it("gives the same answer on a second run", async () => {
      setIndex([{ id: "a1", lightningAddress: null }])
      mockMnemonicExists.mockResolvedValue({ status: "yes" })

      const first = await sweepMnemonicMigration()
      const second = await sweepMnemonicMigration()

      expect(second).toEqual(first)
    })
  })
})
