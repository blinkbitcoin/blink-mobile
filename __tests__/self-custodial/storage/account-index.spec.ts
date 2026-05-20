const mockGetItem = jest.fn()
const mockSetItem = jest.fn()
const mockGetMnemonicForAccount = jest.fn()

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
  },
}))

import {
  addSelfCustodialAccountId,
  findSelfCustodialAccountByMnemonic,
  listSelfCustodialAccountIds,
  listSelfCustodialAccounts,
  removeSelfCustodialAccountId,
  setSelfCustodialLightningAddress,
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
  })

  describe("listSelfCustodialAccounts", () => {
    it("returns parsed entries from the canonical index", async () => {
      setIndex([
        { id: "a1", lightningAddress: null },
        { id: "a2", lightningAddress: "alice@blink.sv" },
      ])

      const entries = await listSelfCustodialAccounts()

      expect(entries).toEqual([
        { id: "a1", lightningAddress: null },
        { id: "a2", lightningAddress: "alice@blink.sv" },
      ])
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

      const entries = await listSelfCustodialAccounts()

      expect(entries).toEqual([
        { id: "a1", lightningAddress: null },
        { id: "a2", lightningAddress: "alice" },
      ])
    })

    it("returns an empty array on JSON parse error", async () => {
      mockGetItem.mockResolvedValueOnce("not-json")

      const entries = await listSelfCustodialAccounts()

      expect(entries).toEqual([])
    })

    it("migrates legacy id-only list and persists the canonical index", async () => {
      setLegacyOnly(["legacy-a", "legacy-b"])

      const entries = await listSelfCustodialAccounts()

      expect(entries).toEqual([
        { id: "legacy-a", lightningAddress: null },
        { id: "legacy-b", lightningAddress: null },
      ])
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

      const entries = await listSelfCustodialAccounts()

      expect(entries.map((e) => e.id)).toEqual(["legacy-a", "legacy-b"])
    })
  })

  describe("listSelfCustodialAccountIds", () => {
    it("returns the id array projection", async () => {
      setIndex([
        { id: "a1", lightningAddress: null },
        { id: "a2", lightningAddress: "alice@blink.sv" },
      ])

      const ids = await listSelfCustodialAccountIds()

      expect(ids).toEqual(["a1", "a2"])
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
  })

  describe("findSelfCustodialAccountByMnemonic (Critical #3)", () => {
    const STORED = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu"

    beforeEach(() => {
      setIndex([
        { id: "a1", lightningAddress: null },
        { id: "a2", lightningAddress: null },
      ])
    })

    it("matches the same mnemonic on exact whitespace", async () => {
      mockGetMnemonicForAccount.mockImplementation((id: string) =>
        Promise.resolve(id === "a2" ? STORED : "other words"),
      )

      const id = await findSelfCustodialAccountByMnemonic(STORED)

      expect(id).toBe("a2")
    })

    it("matches on input with leading and trailing whitespace", async () => {
      mockGetMnemonicForAccount.mockImplementation((id: string) =>
        Promise.resolve(id === "a2" ? STORED : "other words"),
      )

      const id = await findSelfCustodialAccountByMnemonic(`  ${STORED}  `)

      expect(id).toBe("a2")
    })

    it("matches on input with collapsed-runs of internal whitespace (tabs, multi-space)", async () => {
      mockGetMnemonicForAccount.mockImplementation((id: string) =>
        Promise.resolve(id === "a2" ? STORED : "other words"),
      )

      const noisy = STORED.replace(/ /g, "  \t  ")
      const id = await findSelfCustodialAccountByMnemonic(noisy)

      expect(id).toBe("a2")
    })

    it("matches when the stored value itself has noisy whitespace (legacy data)", async () => {
      const storedNoisy = `\t\t${STORED.replace(/ /g, "    ")}\n`
      mockGetMnemonicForAccount.mockImplementation((id: string) =>
        Promise.resolve(id === "a2" ? storedNoisy : "other words"),
      )

      const id = await findSelfCustodialAccountByMnemonic(STORED)

      expect(id).toBe("a2")
    })

    it("returns null when no entry has the matching mnemonic", async () => {
      mockGetMnemonicForAccount.mockResolvedValue("totally different words")

      const id = await findSelfCustodialAccountByMnemonic(STORED)

      expect(id).toBeNull()
    })

    it("returns null when an entry has no stored mnemonic", async () => {
      mockGetMnemonicForAccount.mockResolvedValue(null)

      const id = await findSelfCustodialAccountByMnemonic(STORED)

      expect(id).toBeNull()
    })
  })
})
