const mockGetItem = jest.fn()
const mockSetItem = jest.fn()
const mockGetMnemonicForAccount = jest.fn()
const mockReadMnemonicWithStatus = jest.fn()
const mockGetMnemonicNetworkForAccount = jest.fn()
const mockRememberMnemonicAccount = jest.fn()

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
  },
}))

const mockRecordError = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
  log: jest.fn(),
}))

import {
  addSelfCustodialAccountId,
  findSelfCustodialAccountByMnemonic,
  listSelfCustodialAccounts,
  StorageReadStatus,
  removeSelfCustodialAccountId,
  setSelfCustodialLightningAddress,
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
    mockRememberMnemonicAccount.mockResolvedValue(undefined)
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

      expect(result).toEqual({ status: StorageReadStatus.Ok, id: "a2" })
    })

    it("matches on input with leading and trailing whitespace", async () => {
      mockReadMnemonicWithStatus.mockImplementation((id: string) =>
        Promise.resolve({ status: "found", value: id === "a2" ? STORED : "other words" }),
      )

      const result = await findSelfCustodialAccountByMnemonic(`  ${STORED}  `)

      expect(result).toEqual({ status: StorageReadStatus.Ok, id: "a2" })
    })

    it("matches on input with collapsed-runs of internal whitespace (tabs, multi-space)", async () => {
      mockReadMnemonicWithStatus.mockImplementation((id: string) =>
        Promise.resolve({ status: "found", value: id === "a2" ? STORED : "other words" }),
      )

      const noisy = STORED.replace(/ /g, "  \t  ")
      const result = await findSelfCustodialAccountByMnemonic(noisy)

      expect(result).toEqual({ status: StorageReadStatus.Ok, id: "a2" })
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

      expect(result).toEqual({ status: StorageReadStatus.Ok, id: "a2" })
    })

    it("returns ok with id=null when no entry has the matching mnemonic", async () => {
      mockReadMnemonicWithStatus.mockResolvedValue({
        status: "found",
        value: "totally different words",
      })

      const result = await findSelfCustodialAccountByMnemonic(STORED)

      expect(result).toEqual({ status: StorageReadStatus.Ok, id: null })
    })

    it("returns ok with id=null when an entry has no stored mnemonic", async () => {
      mockReadMnemonicWithStatus.mockResolvedValue({ status: "absent" })

      const result = await findSelfCustodialAccountByMnemonic(STORED)

      expect(result).toEqual({ status: StorageReadStatus.Ok, id: null })
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
     * A keystore that cannot answer is not "this is a different account".
     * Scored that way, restoring a wallet already on the device reports no
     * match and the caller creates a second account for the same seed.
     */
    it("returns read-failed when a mnemonic read fails, never 'no match'", async () => {
      mockReadMnemonicWithStatus.mockResolvedValue({
        status: "failed",
        err: new Error("keystore unavailable"),
      })

      const result = await findSelfCustodialAccountByMnemonic(STORED)

      expect(result.status).toBe(StorageReadStatus.ReadFailed)
    })
  })

  describe("sweepMnemonicMigration", () => {
    it("reads every account in the index, so an unopened one still migrates", async () => {
      setIndex([
        { id: "a1", lightningAddress: null },
        { id: "a2", lightningAddress: null },
      ])
      mockReadMnemonicWithStatus.mockResolvedValue({ status: "found", value: "words" })

      const result = await sweepMnemonicMigration()

      expect(result).toEqual({ status: "ok", migrated: 2 })
      expect(mockReadMnemonicWithStatus).toHaveBeenCalledWith("a1")
      expect(mockReadMnemonicWithStatus).toHaveBeenCalledWith("a2")
      // The network marker migrates on the same pass.
      expect(mockGetMnemonicNetworkForAccount).toHaveBeenCalledWith("a1")
      expect(mockGetMnemonicNetworkForAccount).toHaveBeenCalledWith("a2")
      // An upgrading install records its accounts here or nowhere: the wipe
      // has no other way to learn about a mnemonic it never wrote.
      expect(mockRememberMnemonicAccount).toHaveBeenCalledWith("a1")
      expect(mockRememberMnemonicAccount).toHaveBeenCalledWith("a2")
    })

    it("carries on past an account it cannot read, and reports it", async () => {
      setIndex([
        { id: "a1", lightningAddress: null },
        { id: "a2", lightningAddress: null },
      ])
      mockReadMnemonicWithStatus.mockImplementation((id: string) =>
        id === "a1"
          ? Promise.resolve({ status: "failed", err: new Error("locked") })
          : Promise.resolve({ status: "found", value: "words" }),
      )

      const result = await sweepMnemonicMigration()

      expect(result).toEqual({ status: "incomplete", failures: 1 })
      // The account behind the failure is still swept.
      expect(mockReadMnemonicWithStatus).toHaveBeenCalledWith("a2")
      // The unreadable one is never recorded: the wipe must not be pointed at
      // a slot nothing confirmed.
      expect(mockRememberMnemonicAccount).not.toHaveBeenCalledWith("a1")
      expect(mockRecordError).toHaveBeenCalled()
    })

    it("is a no-op on a fresh install", async () => {
      const result = await sweepMnemonicMigration()

      expect(result).toEqual({ status: "ok", migrated: 0 })
      expect(mockReadMnemonicWithStatus).not.toHaveBeenCalled()
    })

    it("reports incomplete when the index itself cannot be read", async () => {
      mockGetItem.mockRejectedValueOnce(new Error("AsyncStorage unavailable"))

      const result = await sweepMnemonicMigration()

      expect(result).toEqual({ status: "incomplete", failures: 0 })
      expect(mockReadMnemonicWithStatus).not.toHaveBeenCalled()
    })

    it("gives the same answer on a second run", async () => {
      setIndex([{ id: "a1", lightningAddress: null }])
      mockReadMnemonicWithStatus.mockResolvedValue({ status: "found", value: "words" })

      const first = await sweepMnemonicMigration()
      const second = await sweepMnemonicMigration()

      expect(second).toEqual(first)
    })
  })
})
