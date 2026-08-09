import { WalletCurrency } from "@app/graphql/generated"
import {
  latestOnchainReceiptId,
  loadIssuedOnchainAddress,
  saveIssuedOnchainAddress,
} from "@app/self-custodial/storage/onchain-address"
import {
  NormalizedTransaction,
  PaymentType,
  TransactionDirection,
  TransactionStatus,
} from "@app/types/transaction"

jest.mock("@app/utils/error-reporting", () => ({
  recordAppError: jest.fn(),
}))

const store = new Map<string, string>()

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
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

describe("issued onchain address record", () => {
  beforeEach(() => {
    store.clear()
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
})
