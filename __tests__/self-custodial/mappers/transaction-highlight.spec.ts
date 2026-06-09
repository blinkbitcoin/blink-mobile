import { WalletCurrency } from "@app/graphql/generated"
import {
  PaymentType,
  TransactionDirection,
  TransactionStatus,
  type NormalizedTransaction,
} from "@app/types/transaction"
import { AccountType } from "@app/types/wallet"

import { toTransactionFragments } from "@app/self-custodial/mappers/to-transaction-fragment"
import {
  resolveHighlightBaseline,
  shouldHighlightByTimestamp,
} from "@app/self-custodial/mappers/transaction-highlight"

const createTx = (
  overrides: Partial<NormalizedTransaction> = {},
): NormalizedTransaction => ({
  id: "tx-1",
  amount: {
    amount: 1000,
    currency: WalletCurrency.Btc,
    currencyCode: WalletCurrency.Btc,
  },
  direction: TransactionDirection.Receive,
  status: TransactionStatus.Completed,
  timestamp: 1_700_000_000,
  paymentType: PaymentType.Lightning,
  sourceAccountType: AccountType.SelfCustodial,
  ...overrides,
})

describe("shouldHighlightByTimestamp", () => {
  it("highlights only the latest when there is no baseline", () => {
    expect(
      shouldHighlightByTimestamp({
        createdAt: 1_700_000_500,
        baselineCreatedAt: null,
        isLatestForCurrency: true,
      }),
    ).toBe(true)

    expect(
      shouldHighlightByTimestamp({
        createdAt: 1_700_000_500,
        baselineCreatedAt: null,
        isLatestForCurrency: false,
      }),
    ).toBe(false)
  })

  it("highlights a transaction created after the baseline", () => {
    expect(
      shouldHighlightByTimestamp({
        createdAt: 1_700_000_600,
        baselineCreatedAt: 1_700_000_500,
        isLatestForCurrency: false,
      }),
    ).toBe(true)
  })

  it("does not highlight a transaction at or before the baseline", () => {
    expect(
      shouldHighlightByTimestamp({
        createdAt: 1_700_000_500,
        baselineCreatedAt: 1_700_000_500,
        isLatestForCurrency: true,
      }),
    ).toBe(false)

    expect(
      shouldHighlightByTimestamp({
        createdAt: 1_700_000_400,
        baselineCreatedAt: 1_700_000_500,
        isLatestForCurrency: false,
      }),
    ).toBe(false)
  })
})

describe("resolveHighlightBaseline", () => {
  const fragments = toTransactionFragments([
    createTx({ id: "btc-newest", timestamp: 1_700_000_900 }),
    createTx({ id: "usd-newest", timestamp: 1_700_000_800 }),
  ])

  it("resolves each baseline id to its createdAt timestamp", () => {
    expect(
      resolveHighlightBaseline({
        fragments,
        baselineBtcId: "btc-newest",
        baselineUsdId: "usd-newest",
      }),
    ).toEqual({ btc: 1_700_000_900, usd: 1_700_000_800 })
  })

  it("returns null for an id absent from the loaded fragments (paged out)", () => {
    expect(
      resolveHighlightBaseline({
        fragments,
        baselineBtcId: "missing",
        baselineUsdId: "usd-newest",
      }),
    ).toEqual({ btc: null, usd: 1_700_000_800 })
  })

  it("returns null for an empty or undefined baseline id", () => {
    expect(
      resolveHighlightBaseline({
        fragments,
        baselineBtcId: "",
        baselineUsdId: undefined,
      }),
    ).toEqual({ btc: null, usd: null })
  })
})
