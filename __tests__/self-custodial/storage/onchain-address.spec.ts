import { WalletCurrency } from "@app/graphql/generated"
import {
  latestOnchainReceiptId,
  loadIssuedOnchainAddress,
  mergeSeenPendingDepositIds,
  saveIssuedOnchainAddress,
} from "@app/self-custodial/storage/onchain-address"
import {
  NormalizedTransaction,
  PaymentType,
  TransactionDirection,
  TransactionStatus,
} from "@app/types/transaction"

const mockRecordAppError = jest.fn()

jest.mock("@app/utils/error-reporting", () => ({
  recordAppError: (...args: unknown[]) => mockRecordAppError(...args),
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
  },
}))

const ACCOUNT_ID = "account-1"
const STORAGE_KEY = `selfCustodialOnchainAddress:${ACCOUNT_ID}`

const tx = (
  id: string,
  paymentType: PaymentType,
  direction: TransactionDirection,
): NormalizedTransaction => ({
  id,
  amount: { amount: 1000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
  direction,
  status: TransactionStatus.Completed,
  timestamp: 1_700_000_000,
  paymentType,
})

describe("latestOnchainReceiptId", () => {
  it("returns null when there are no transactions", () => {
    expect(latestOnchainReceiptId([])).toBeNull()
  })

  it("returns the newest incoming on-chain transaction id", () => {
    const transactions = [
      tx("onchain-new", PaymentType.Onchain, TransactionDirection.Receive),
      tx("onchain-old", PaymentType.Onchain, TransactionDirection.Receive),
    ]

    expect(latestOnchainReceiptId(transactions)).toBe("onchain-new")
  })

  it("ignores on-chain sends and lightning receipts", () => {
    const transactions = [
      tx("onchain-send", PaymentType.Onchain, TransactionDirection.Send),
      tx("ln-receive", PaymentType.Lightning, TransactionDirection.Receive),
      tx("onchain-receive", PaymentType.Onchain, TransactionDirection.Receive),
    ]

    expect(latestOnchainReceiptId(transactions)).toBe("onchain-receive")
  })

  it("returns null when the wallet has only sent on-chain", () => {
    expect(
      latestOnchainReceiptId([
        tx("onchain-send", PaymentType.Onchain, TransactionDirection.Send),
      ]),
    ).toBeNull()
  })
})

describe("mergeSeenPendingDepositIds", () => {
  it("starts from nothing when no ids were stored", () => {
    expect(mergeSeenPendingDepositIds(undefined, ["a", "b"])).toEqual(["a", "b"])
  })

  it("adds only ids that are new", () => {
    expect(mergeSeenPendingDepositIds(["a"], ["a", "b"])).toEqual(["a", "b"])
  })

  it("never forgets an id just because the listing came back empty", () => {
    // The listing resolves empty on failure too, so shrinking to match it would let
    // the same deposits trigger a rotation all over again.
    expect(mergeSeenPendingDepositIds(["a", "b"], [])).toEqual(["a", "b"])
  })

  it("keeps the 50 most recent ids", () => {
    const stored = Array.from({ length: 50 }, (_, i) => `stored-${i}`)

    const merged = mergeSeenPendingDepositIds(stored, ["fresh"])

    expect(merged).toHaveLength(50)
    expect(merged[0]).toBe("stored-1")
    expect(merged[49]).toBe("fresh")
  })
})

describe("issued onchain address record", () => {
  beforeEach(() => {
    store.clear()
    delete storageFailure.read
    delete storageFailure.write
    jest.clearAllMocks()
  })

  it("round-trips an address and its deposit marker", async () => {
    await saveIssuedOnchainAddress(ACCOUNT_ID, {
      address: "bc1qaddress",
      depositMarker: "onchain-1",
    })

    expect(await loadIssuedOnchainAddress(ACCOUNT_ID)).toEqual({
      address: "bc1qaddress",
      depositMarker: "onchain-1",
    })
  })

  it("keeps a null marker for a wallet that has never received", async () => {
    await saveIssuedOnchainAddress(ACCOUNT_ID, {
      address: "bc1qaddress",
      depositMarker: null,
    })

    expect(await loadIssuedOnchainAddress(ACCOUNT_ID)).toEqual({
      address: "bc1qaddress",
      depositMarker: null,
    })
  })

  it("returns null when no record was ever written", async () => {
    expect(await loadIssuedOnchainAddress(ACCOUNT_ID)).toBeNull()
  })

  it("keys records per account", async () => {
    await saveIssuedOnchainAddress(ACCOUNT_ID, {
      address: "bc1qaccount1",
      depositMarker: null,
    })
    await saveIssuedOnchainAddress("account-2", {
      address: "bc1qaccount2",
      depositMarker: null,
    })

    expect((await loadIssuedOnchainAddress(ACCOUNT_ID))?.address).toBe("bc1qaccount1")
    expect((await loadIssuedOnchainAddress("account-2"))?.address).toBe("bc1qaccount2")
  })

  it("treats unparseable stored data as no record", async () => {
    store.set(STORAGE_KEY, "{not json")

    expect(await loadIssuedOnchainAddress(ACCOUNT_ID)).toBeNull()
  })

  it("treats a record of the wrong shape as no record", async () => {
    store.set(STORAGE_KEY, JSON.stringify({ address: 42 }))

    expect(await loadIssuedOnchainAddress(ACCOUNT_ID)).toBeNull()
  })

  const malformed: [string, unknown][] = [
    ["a missing marker key", { address: "bc1q" }],
    ["a non-string marker", { address: "bc1q", depositMarker: 7 }],
    ["a non-object payload", "just a string"],
    ["null", null],
  ]

  malformed.forEach(([label, payload]) => {
    it(`treats ${label} as no record`, async () => {
      store.set(STORAGE_KEY, JSON.stringify(payload))

      expect(await loadIssuedOnchainAddress(ACCOUNT_ID)).toBeNull()
    })
  })

  it("round-trips the unclaimed deposits it has rotated for", async () => {
    await saveIssuedOnchainAddress(ACCOUNT_ID, {
      address: "bc1qaddress",
      depositMarker: null,
      seenPendingDepositIds: ["txid-1:0", "txid-2:1"],
    })

    expect(await loadIssuedOnchainAddress(ACCOUNT_ID)).toEqual({
      address: "bc1qaddress",
      depositMarker: null,
      seenPendingDepositIds: ["txid-1:0", "txid-2:1"],
    })
  })

  it("still reads a record written before deposits were tracked", async () => {
    store.set(STORAGE_KEY, JSON.stringify({ address: "bc1qold", depositMarker: "tx-1" }))

    expect(await loadIssuedOnchainAddress(ACCOUNT_ID)).toEqual({
      address: "bc1qold",
      depositMarker: "tx-1",
      seenPendingDepositIds: undefined,
    })
  })

  const malformedIds: [string, unknown][] = [
    ["not an array", "txid-1:0"],
    ["an array of the wrong type", [7, { id: "txid-1:0" }]],
  ]

  malformedIds.forEach(([label, seenPendingDepositIds]) => {
    // Rejecting the whole record here would read as "no address issued yet", which
    // turns the reuse detection off entirely — a far worse outcome than losing a list.
    it(`keeps the record when the deposit ids are ${label}`, async () => {
      store.set(
        STORAGE_KEY,
        JSON.stringify({ address: "bc1q", depositMarker: "tx-1", seenPendingDepositIds }),
      )

      expect(await loadIssuedOnchainAddress(ACCOUNT_ID)).toEqual({
        address: "bc1q",
        depositMarker: "tx-1",
        seenPendingDepositIds: undefined,
      })
    })
  })

  it("reports an unreadable store instead of throwing", async () => {
    storageFailure.read = new Error("storage read exploded")

    await expect(loadIssuedOnchainAddress(ACCOUNT_ID)).resolves.toBeNull()
    expect(mockRecordAppError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "storage read exploded" }),
    )
  })

  it("describes a non-Error read failure", async () => {
    storageFailure.read = "read blew up"

    await expect(loadIssuedOnchainAddress(ACCOUNT_ID)).resolves.toBeNull()
    expect(mockRecordAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Issued onchain address read failed: read blew up",
      }),
    )
  })

  it("describes a non-Error write failure", async () => {
    storageFailure.write = "write blew up"

    await saveIssuedOnchainAddress(ACCOUNT_ID, { address: "bc1q", depositMarker: null })

    expect(mockRecordAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Issued onchain address write failed: write blew up",
      }),
    )
  })

  it("swallows a write failure so the address on screen still stands", async () => {
    storageFailure.write = new Error("storage write exploded")

    await expect(
      saveIssuedOnchainAddress(ACCOUNT_ID, { address: "bc1q", depositMarker: null }),
    ).resolves.toBeUndefined()
    expect(mockRecordAppError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "storage write exploded" }),
    )
  })
})
