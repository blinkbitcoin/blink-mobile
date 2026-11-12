import {
  LOST_ATTEMPTS_TTL_MS,
  loadLostAttempts,
  lostAttemptsWalletId,
  removeLostAttempts,
  saveLostAttempts,
} from "@app/self-custodial/storage/lost-attempts"

const mockReportError = jest.fn()

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const store = new Map<string, string>()
const storageFailure: { read?: unknown; write?: unknown } = {}

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => {
      if (storageFailure.read) throw storageFailure.read
      return store.get(key) ?? null
    },
    setItem: async (key: string, value: string) => {
      if (storageFailure.write) throw storageFailure.write
      store.set(key, value)
    },
    removeItem: async (key: string) => {
      if (storageFailure.write) throw storageFailure.write
      store.delete(key)
    },
  },
}))

const WALLET = "/documents/breez-sdk-spark-mainnet/wallet-a"
const STORAGE_KEY = `selfCustodialLostAttempts:${WALLET}`
const NOW = 1_800_000_000_000

const lostSend = (startedAtMs = NOW - 1000) => ({
  startedAtMs,
  walletClockSec: 1_700_000_000,
  paymentHashes: ["hash-1"],
  sparkInvoices: [],
  idempotencyKey: "key-1",
})
const unresolvedSend = (recordedAtMs = NOW - 1000) => ({
  idempotencyKey: "key-2",
  recordedAtMs,
})

const stored = (value: unknown) => store.set(STORAGE_KEY, JSON.stringify(value))

beforeEach(() => {
  jest.clearAllMocks()
  store.clear()
  delete storageFailure.read
  delete storageFailure.write
})

describe("saveLostAttempts", () => {
  it("keeps a wallet's attempts by destination under the wallet's own key", async () => {
    await saveLostAttempts(WALLET, new Map([["sp1abc", { lostSend: lostSend() }]]))

    expect(JSON.parse(store.get(STORAGE_KEY) ?? "")).toEqual({
      sp1abc: { lostSend: lostSend() },
    })
  })

  it("removes the key once the wallet holds no attempt", async () => {
    stored({ sp1abc: { lostSend: lostSend() } })

    await saveLostAttempts(WALLET, new Map())

    expect(store.has(STORAGE_KEY)).toBe(false)
  })

  it("reports a removal that fails, without throwing at the send", async () => {
    storageFailure.write = new Error("io")

    await expect(saveLostAttempts(WALLET, new Map())).resolves.toBeUndefined()
    expect(mockReportError).toHaveBeenCalledWith(
      "Self-custodial lost attempts save",
      storageFailure.write,
    )
  })

  it("reports a write that fails, without throwing at the send", async () => {
    storageFailure.write = new Error("disk full")

    await expect(
      saveLostAttempts(WALLET, new Map([["sp1abc", { lostSend: lostSend() }]])),
    ).resolves.toBeUndefined()
    expect(mockReportError).toHaveBeenCalledWith(
      "Self-custodial lost attempts save",
      storageFailure.write,
    )
  })
})

describe("removeLostAttempts", () => {
  it("forgets everything a wallet kept", async () => {
    stored({ sp1abc: { lostSend: lostSend() } })

    await removeLostAttempts(WALLET)

    expect(store.has(STORAGE_KEY)).toBe(false)
  })

  it("lets its caller see a removal that failed", async () => {
    storageFailure.write = new Error("io")

    await expect(removeLostAttempts(WALLET)).rejects.toThrow("io")
  })
})

describe("lostAttemptsWalletId", () => {
  it("names a wallet by its network and account", () => {
    expect(lostAttemptsWalletId("acct-1", 0 as never)).toBe("0:acct-1")
  })
})

describe("loadLostAttempts", () => {
  it("reads back what was saved", async () => {
    const attempts = new Map([
      ["sp1abc", { lostSend: lostSend(), unresolvedSend: unresolvedSend() }],
    ])
    await saveLostAttempts(WALLET, attempts)

    expect(await loadLostAttempts(WALLET, NOW)).toEqual(attempts)
  })

  it("reads back what each attempt was asked for", async () => {
    const attempts = new Map([
      [
        "sp1abc",
        {
          lostSend: {
            ...lostSend(),
            requestedAs: { "hash:hash-1": { entered: "USD:500", settlement: "BTC:700" } },
          },
          unresolvedSend: {
            ...unresolvedSend(),
            requestedAs: { entered: "BTC:1000", settlement: "BTC:1000" },
          },
        },
      ],
    ])
    await saveLostAttempts(WALLET, attempts)

    expect(await loadLostAttempts(WALLET, NOW)).toEqual(attempts)
  })

  it("holds nothing for a wallet that never saved", async () => {
    expect(await loadLostAttempts(WALLET, NOW)).toEqual(new Map())
  })

  it("keeps each wallet's attempts apart", async () => {
    await saveLostAttempts(WALLET, new Map([["sp1abc", { lostSend: lostSend() }]]))

    expect(await loadLostAttempts("/documents/other-wallet", NOW)).toEqual(new Map())
  })

  it("drops an attempt past its time, keeping one that is not", async () => {
    stored({
      sp1old: { lostSend: lostSend(NOW - LOST_ATTEMPTS_TTL_MS) },
      sp1new: { lostSend: lostSend(NOW - LOST_ATTEMPTS_TTL_MS + 1) },
    })

    expect([...(await loadLostAttempts(WALLET, NOW)).keys()]).toEqual(["sp1new"])
  })

  it("keeps a lost send whose first attempt is old while its latest is recent", async () => {
    const mergedSend = {
      ...lostSend(NOW - LOST_ATTEMPTS_TTL_MS - 1000),
      lastAttemptAtMs: NOW - 1000,
    }
    stored({ sp1abc: { lostSend: mergedSend } })

    expect((await loadLostAttempts(WALLET, NOW)).get("sp1abc")).toEqual({
      lostSend: mergedSend,
    })
  })

  it("drops a lost send whose latest attempt is past its time too", async () => {
    stored({
      sp1abc: {
        lostSend: {
          ...lostSend(NOW - LOST_ATTEMPTS_TTL_MS - 2000),
          lastAttemptAtMs: NOW - LOST_ATTEMPTS_TTL_MS,
        },
      },
    })

    expect(await loadLostAttempts(WALLET, NOW)).toEqual(new Map())
  })

  it("drops a stale half of a destination without the other", async () => {
    stored({
      sp1abc: {
        lostSend: lostSend(NOW - LOST_ATTEMPTS_TTL_MS),
        unresolvedSend: unresolvedSend(),
      },
    })

    expect((await loadLostAttempts(WALLET, NOW)).get("sp1abc")).toEqual({
      unresolvedSend: unresolvedSend(),
    })
  })

  it("drops an unresolved attempt with no time recorded, which cannot be aged", async () => {
    stored({ sp1abc: { unresolvedSend: { idempotencyKey: "key-2" } } })

    expect(await loadLostAttempts(WALLET, NOW)).toEqual(new Map())
  })

  it("drops a half that does not read as an attempt, keeping the other", async () => {
    stored({
      sp1abc: {
        lostSend: { ...lostSend(), paymentHashes: "hash-1" },
        unresolvedSend: unresolvedSend(),
      },
      sp1def: {
        lostSend: lostSend(),
        unresolvedSend: { idempotencyKey: 7, recordedAtMs: NOW },
      },
      sp1ghi: { lostSend: { ...lostSend(), startedAtMs: "yesterday" } },
      sp1jkl: { unresolvedSend: "key-2" },
      sp1mno: { lostSend: { ...lostSend(), idempotencyKey: 7 } },
      sp1stu: { lostSend: { ...lostSend(), lastAttemptAtMs: "now" } },
      sp1vwx: { lostSend: { ...lostSend(), requestedAs: { "hash:hash-1": 500 } } },
      sp1yza: { unresolvedSend: { ...unresolvedSend(), requestedAs: 500 } },
      sp1bcd: {
        unresolvedSend: { ...unresolvedSend(), requestedAs: { entered: "USD:500" } },
      },
      sp1efg: {
        lostSend: {
          ...lostSend(),
          requestedAs: { "hash:hash-1": { entered: 500, settlement: "BTC:700" } },
        },
      },
      sp1pqr: "not an entry",
    })

    expect(await loadLostAttempts(WALLET, NOW)).toEqual(
      new Map([
        ["sp1abc", { unresolvedSend: unresolvedSend() }],
        ["sp1def", { lostSend: lostSend() }],
      ]),
    )
  })

  it("holds nothing when what was stored is not a record of destinations", async () => {
    store.set(STORAGE_KEY, JSON.stringify(["sp1abc"]))
    expect(await loadLostAttempts(WALLET, NOW)).toEqual(new Map())

    store.set(STORAGE_KEY, "null")
    expect(await loadLostAttempts(WALLET, NOW)).toEqual(new Map())
  })

  /** Content that no longer parses is unusable for good: it reads as nothing stored, and
   *  the next save replaces it. Only a read that fails is reported. */
  it("holds nothing for a store that no longer parses", async () => {
    store.set(STORAGE_KEY, "{not json")

    expect(await loadLostAttempts(WALLET, NOW)).toEqual(new Map())
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it("reports a read that fails and throws it, since it is no answer", async () => {
    storageFailure.read = new Error("io")

    await expect(loadLostAttempts(WALLET, NOW)).rejects.toThrow("io")
    expect(mockReportError).toHaveBeenCalledWith(
      "Self-custodial lost attempts load",
      storageFailure.read,
    )
  })

  it("ages attempts by the clock now when none is given", async () => {
    stored({ sp1abc: { lostSend: lostSend(Date.now()) } })

    expect((await loadLostAttempts(WALLET)).has("sp1abc")).toBe(true)
  })
})
