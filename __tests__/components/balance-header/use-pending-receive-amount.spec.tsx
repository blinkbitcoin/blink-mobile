import { renderHook } from "@testing-library/react-native"

import { usePendingReceiveAmount } from "@app/components/balance-header/use-pending-receive-amount"
import { TransactionFragment, TxDirection, WalletCurrency } from "@app/graphql/generated"
import { DisplayCurrency } from "@app/types/amounts"
import { DepositStatus, PendingDeposit } from "@app/types/payment"
import { AccountType } from "@app/types/wallet"

const mockConvertMoneyAmount = jest.fn()
const mockFormatMoneyAmount = jest.fn(
  ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
    `$${(moneyAmount.amount / 100).toFixed(2)}`,
)
/** Mirrors formatCurrencyHelper: Number()s string majors, 2 fraction digits. */
const mockFormatCurrency = jest.fn(
  ({
    amountInMajorUnits,
    currency,
  }: {
    amountInMajorUnits: number | string
    currency: string
  }) => `${currency} ${Number(amountInMajorUnits).toFixed(2)}`,
)
let mockDisplayCurrency = "USD"
let mockLoadedCurrencyCode = "USD"
const mockUseAccountRegistry = jest.fn()

jest.mock("@app/hooks", () => ({
  ...jest.requireActual("@app/hooks"),
  usePriceConversion: () => ({ convertMoneyAmount: mockConvertMoneyAmount() }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: mockFormatMoneyAmount,
    formatCurrency: mockFormatCurrency,
    displayCurrency: mockDisplayCurrency,
    currencyInfo: { DisplayCurrency: { currencyCode: mockLoadedCurrencyCode } },
  }),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

/**
 * BTC passes through, USD is scaled by a distinct factor. A converter that
 * ignored the incoming currency would still make a BTC-only total add up, so
 * the mix has to be priced per settlement currency to reach the expected sum.
 */
const USD_TO_DISPLAY_FACTOR = 10

const mockConverter = jest.fn(
  ({ amount, currency }: { amount: number; currency: string }) => ({
    amount: currency === WalletCurrency.Usd ? amount * USD_TO_DISPLAY_FACTOR : amount,
    currency: "DisplayCurrency",
    currencyCode: "USD",
  }),
)

const pendingReceiveTx = (
  overrides: Partial<TransactionFragment> = {},
): TransactionFragment =>
  ({
    id: "tx-1",
    direction: TxDirection.Receive,
    status: "PENDING",
    settlementAmount: 12_345,
    settlementCurrency: WalletCurrency.Btc,
    ...overrides,
  }) as TransactionFragment

const deposit = (overrides: Partial<PendingDeposit> = {}): PendingDeposit => ({
  id: "abc:0",
  txid: "abc",
  vout: 0,
  amount: { amount: 5_000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
  status: DepositStatus.Immature,
  errorReason: null,
  ...overrides,
})

describe("usePendingReceiveAmount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDisplayCurrency = "USD"
    mockLoadedCurrencyCode = "USD"
    mockConvertMoneyAmount.mockReturnValue(mockConverter)
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { type: AccountType.Custodial },
    })
  })

  describe("custodial", () => {
    it("formats the amount of a single pending incoming transaction", () => {
      const { result } = renderHook(() =>
        usePendingReceiveAmount({ pendingIncomingTransactions: [pendingReceiveTx()] }),
      )

      expect(result.current.pendingReceiveAmountText).toBe("$123.45")
    })

    it("sums pending transactions across BTC and USD wallets", () => {
      const { result } = renderHook(() =>
        usePendingReceiveAmount({
          pendingIncomingTransactions: [
            pendingReceiveTx({ id: "tx-btc", settlementAmount: 10_000 }),
            pendingReceiveTx({
              id: "tx-usd",
              settlementAmount: 2_000,
              settlementCurrency: WalletCurrency.Usd,
            }),
          ],
        }),
      )

      // 10_000 sats + (2_000 cents x 10), i.e. each priced by its own currency
      expect(result.current.pendingReceiveAmountText).toBe("$300.00")
      expect(mockConverter).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 2_000, currency: WalletCurrency.Usd }),
        DisplayCurrency,
      )
    })

    it("returns null when there are no pending transactions", () => {
      const { result } = renderHook(() =>
        usePendingReceiveAmount({ pendingIncomingTransactions: [] }),
      )

      expect(result.current.pendingReceiveAmountText).toBeNull()
    })

    it("returns null when transactions are undefined (query still loading)", () => {
      const { result } = renderHook(() =>
        usePendingReceiveAmount({ pendingIncomingTransactions: undefined }),
      )

      expect(result.current.pendingReceiveAmountText).toBeNull()
    })

    it("ignores outgoing and zero-amount transactions", () => {
      const { result } = renderHook(() =>
        usePendingReceiveAmount({
          pendingIncomingTransactions: [
            pendingReceiveTx({ id: "tx-out", direction: TxDirection.Send }),
            pendingReceiveTx({ id: "tx-zero", settlementAmount: 0 }),
          ],
        }),
      )

      expect(result.current.pendingReceiveAmountText).toBeNull()
    })

    it("returns null while price conversion is bootstrapping", () => {
      mockConvertMoneyAmount.mockReturnValue(undefined)

      const { result } = renderHook(() =>
        usePendingReceiveAmount({ pendingIncomingTransactions: [pendingReceiveTx()] }),
      )

      expect(result.current.pendingReceiveAmountText).toBeNull()
    })

    it("ignores negative-amount transactions (defensive: pending receives are positive)", () => {
      const { result } = renderHook(() =>
        usePendingReceiveAmount({
          pendingIncomingTransactions: [
            pendingReceiveTx({ id: "tx-neg", settlementAmount: -500 }),
          ],
        }),
      )

      expect(result.current.pendingReceiveAmountText).toBeNull()
    })

    it("returns null when conversion rounds the total to zero", () => {
      mockConvertMoneyAmount.mockReturnValue(() => ({
        amount: 0,
        currency: "DisplayCurrency",
        currencyCode: "USD",
      }))

      const { result } = renderHook(() =>
        usePendingReceiveAmount({ pendingIncomingTransactions: [pendingReceiveTx()] }),
      )

      expect(result.current.pendingReceiveAmountText).toBeNull()
    })

    it("sums server-locked settlementDisplayAmounts — the same source the unseen-tx badge formats", () => {
      const { result } = renderHook(() =>
        usePendingReceiveAmount({
          pendingIncomingTransactions: [
            pendingReceiveTx({
              id: "a",
              settlementDisplayAmount: "500.00",
              settlementDisplayCurrency: "USD",
            }),
            pendingReceiveTx({
              id: "b",
              settlementDisplayAmount: "0.50",
              settlementDisplayCurrency: "USD",
            }),
          ],
        }),
      )

      expect(mockFormatCurrency).toHaveBeenCalledWith({
        amountInMajorUnits: 500.5,
        currency: "USD",
      })
      expect(result.current.pendingReceiveAmountText).toBe("USD 500.50")
      expect(mockConverter).not.toHaveBeenCalled()
    })

    it("matches the unseen-tx badge amount for a single pending receive", () => {
      const tx = pendingReceiveTx({
        settlementDisplayAmount: "500.00",
        settlementDisplayCurrency: "USD",
      })

      const { result } = renderHook(() =>
        usePendingReceiveAmount({ pendingIncomingTransactions: [tx] }),
      )

      // Exactly what use-unseen-tx-amount-badge feeds formatCurrency.
      const badgeText = mockFormatCurrency({
        amountInMajorUnits: tx.settlementDisplayAmount as string,
        currency: tx.settlementDisplayCurrency as string,
      })
      expect(result.current.pendingReceiveAmountText).toBe(badgeText)
    })

    it("renders from display amounts even while price conversion is bootstrapping", () => {
      mockConvertMoneyAmount.mockReturnValue(undefined)

      const { result } = renderHook(() =>
        usePendingReceiveAmount({
          pendingIncomingTransactions: [
            pendingReceiveTx({
              settlementDisplayAmount: "12.34",
              settlementDisplayCurrency: "EUR",
            }),
          ],
        }),
      )

      expect(result.current.pendingReceiveAmountText).toBe("EUR 12.34")
    })

    it("falls back to live-rate conversion when a display amount is missing", () => {
      const { result } = renderHook(() =>
        usePendingReceiveAmount({
          pendingIncomingTransactions: [
            pendingReceiveTx({
              id: "with-display",
              settlementAmount: 10_000,
              settlementDisplayAmount: "100.00",
              settlementDisplayCurrency: "USD",
            }),
            pendingReceiveTx({ id: "without-display", settlementAmount: 2_345 }),
          ],
        }),
      )

      expect(result.current.pendingReceiveAmountText).toBe("$123.45")
      expect(mockFormatCurrency).not.toHaveBeenCalled()
    })

    it("falls back to live-rate conversion when display currencies disagree", () => {
      const { result } = renderHook(() =>
        usePendingReceiveAmount({
          pendingIncomingTransactions: [
            pendingReceiveTx({
              id: "usd",
              settlementAmount: 10_000,
              settlementDisplayAmount: "100.00",
              settlementDisplayCurrency: "USD",
            }),
            pendingReceiveTx({
              id: "eur",
              settlementAmount: 2_345,
              settlementDisplayAmount: "90.00",
              settlementDisplayCurrency: "EUR",
            }),
          ],
        }),
      )

      expect(result.current.pendingReceiveAmountText).toBe("$123.45")
    })

    it("falls back to live-rate conversion when a display amount is not numeric", () => {
      const { result } = renderHook(() =>
        usePendingReceiveAmount({
          pendingIncomingTransactions: [
            pendingReceiveTx({
              settlementAmount: 10_000,
              settlementDisplayAmount: "not-a-number",
              settlementDisplayCurrency: "USD",
            }),
          ],
        }),
      )

      expect(result.current.pendingReceiveAmountText).toBe("$100.00")
      expect(mockFormatCurrency).not.toHaveBeenCalled()
    })

    it("falls through to conversion when the locked display total is zero (dust)", () => {
      const { result } = renderHook(() =>
        usePendingReceiveAmount({
          pendingIncomingTransactions: [
            pendingReceiveTx({
              settlementAmount: 300,
              settlementDisplayAmount: "0.00",
              settlementDisplayCurrency: "USD",
            }),
          ],
        }),
      )

      expect(result.current.pendingReceiveAmountText).toBe("$3.00")
      expect(mockFormatCurrency).not.toHaveBeenCalled()
    })

    it("sums before converting so several sub-display-unit receives keep the pill nonzero", () => {
      // 0.001 display-minor-units per sat with per-call rounding: each 400-sat
      // receive alone rounds to 0; only a pre-conversion sum survives.
      mockConvertMoneyAmount.mockReturnValue(({ amount }: { amount: number }) => ({
        amount: Math.round(amount * 0.001),
        currency: "DisplayCurrency",
        currencyCode: "USD",
      }))

      const { result } = renderHook(() =>
        usePendingReceiveAmount({
          pendingIncomingTransactions: [
            pendingReceiveTx({ id: "a", settlementAmount: 400 }),
            pendingReceiveTx({ id: "b", settlementAmount: 400 }),
            pendingReceiveTx({ id: "c", settlementAmount: 400 }),
          ],
        }),
      )

      expect(result.current.pendingReceiveAmountText).toBe("$0.01")
    })

    it("suppresses the conversion-fallback pill until the display currency has loaded", () => {
      mockDisplayCurrency = "EUR"
      mockLoadedCurrencyCode = "USD" // currency list not loaded yet

      const { result } = renderHook(() =>
        usePendingReceiveAmount({ pendingIncomingTransactions: [pendingReceiveTx()] }),
      )

      expect(result.current.pendingReceiveAmountText).toBeNull()
      expect(mockFormatMoneyAmount).not.toHaveBeenCalled()
    })
  })

  describe("self-custodial", () => {
    beforeEach(() => {
      mockUseAccountRegistry.mockReturnValue({
        activeAccount: { type: AccountType.SelfCustodial },
      })
    })

    it("sums immature (unconfirmed) deposits", () => {
      const { result } = renderHook(() =>
        usePendingReceiveAmount({
          deposits: [
            deposit({
              id: "a:0",
              amount: {
                amount: 4_000,
                currency: WalletCurrency.Btc,
                currencyCode: "BTC",
              },
            }),
            deposit({
              id: "b:1",
              amount: {
                amount: 6_000,
                currency: WalletCurrency.Btc,
                currencyCode: "BTC",
              },
            }),
          ],
        }),
      )

      expect(result.current.pendingReceiveAmountText).toBe("$100.00")
    })

    it("excludes non-immature deposits (claimable, error, refunded are the banner's job)", () => {
      const { result } = renderHook(() =>
        usePendingReceiveAmount({
          deposits: [
            deposit({ id: "a:0", status: DepositStatus.Claimable }),
            deposit({ id: "b:0", status: DepositStatus.FeeExceeded }),
            deposit({ id: "c:0", status: DepositStatus.Error }),
            deposit({ id: "d:0", status: DepositStatus.Refunded }),
          ],
        }),
      )

      expect(result.current.pendingReceiveAmountText).toBeNull()
    })

    it("returns null when there are no deposits", () => {
      const { result } = renderHook(() => usePendingReceiveAmount({}))

      expect(result.current.pendingReceiveAmountText).toBeNull()
    })

    it("returns null when the only immature deposit has a zero amount", () => {
      const { result } = renderHook(() =>
        usePendingReceiveAmount({
          deposits: [
            deposit({
              id: "z:0",
              amount: { amount: 0, currency: WalletCurrency.Btc, currencyCode: "BTC" },
            }),
          ],
        }),
      )

      expect(result.current.pendingReceiveAmountText).toBeNull()
    })

    it("ignores custodial pending transactions even while the SDK is still connecting", () => {
      // The account registry says self-custodial; wallet status is irrelevant —
      // the old `useActiveWallet().isSelfCustodial` predicate flipped false
      // while the Spark SDK connected and leaked custodial data in here.
      const { result } = renderHook(() =>
        usePendingReceiveAmount({
          pendingIncomingTransactions: [
            pendingReceiveTx({
              settlementDisplayAmount: "500.00",
              settlementDisplayCurrency: "USD",
            }),
          ],
        }),
      )

      expect(result.current.pendingReceiveAmountText).toBeNull()
      expect(mockFormatCurrency).not.toHaveBeenCalled()
    })

    it("suppresses the pill until the display currency has loaded (no degraded string)", () => {
      mockDisplayCurrency = "EUR"
      mockLoadedCurrencyCode = "USD"

      const { result } = renderHook(() =>
        usePendingReceiveAmount({ deposits: [deposit()] }),
      )

      expect(result.current.pendingReceiveAmountText).toBeNull()
      expect(mockFormatMoneyAmount).not.toHaveBeenCalled()
    })
  })
})
