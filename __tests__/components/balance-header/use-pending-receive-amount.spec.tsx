import { renderHook } from "@testing-library/react-native"

import { usePendingReceiveAmount } from "@app/components/balance-header/use-pending-receive-amount"
import { TransactionFragment, TxDirection, WalletCurrency } from "@app/graphql/generated"
import { DepositStatus, PendingDeposit } from "@app/types/payment"

const mockConvertMoneyAmount = jest.fn()
const mockFormatMoneyAmount = jest.fn(
  ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
    `$${(moneyAmount.amount / 100).toFixed(2)}`,
)
const mockUseActiveWallet = jest.fn()
const mockUsePendingDeposits = jest.fn()

jest.mock("@app/hooks", () => ({
  usePriceConversion: () => ({ convertMoneyAmount: mockConvertMoneyAmount() }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ formatMoneyAmount: mockFormatMoneyAmount }),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

jest.mock("@app/self-custodial/hooks", () => ({
  usePendingDeposits: () => mockUsePendingDeposits(),
}))

const identityConverter = ({ amount }: { amount: number }) => ({
  amount,
  currency: "DisplayCurrency",
  currencyCode: "USD",
})

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
    mockConvertMoneyAmount.mockReturnValue(identityConverter)
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: false })
    mockUsePendingDeposits.mockReturnValue({ deposits: [] })
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

      expect(result.current.pendingReceiveAmountText).toBe("$120.00")
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
  })

  describe("self-custodial", () => {
    beforeEach(() => {
      mockUseActiveWallet.mockReturnValue({ isSelfCustodial: true })
    })

    it("sums immature (unconfirmed) deposits", () => {
      mockUsePendingDeposits.mockReturnValue({
        deposits: [
          deposit({
            id: "a:0",
            amount: { amount: 4_000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
          }),
          deposit({
            id: "b:1",
            amount: { amount: 6_000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
          }),
        ],
      })

      const { result } = renderHook(() => usePendingReceiveAmount({}))

      expect(result.current.pendingReceiveAmountText).toBe("$100.00")
    })

    it("excludes non-immature deposits (claimable, error, refunded are the banner's job)", () => {
      mockUsePendingDeposits.mockReturnValue({
        deposits: [
          deposit({ id: "a:0", status: DepositStatus.Claimable }),
          deposit({ id: "b:0", status: DepositStatus.FeeExceeded }),
          deposit({ id: "c:0", status: DepositStatus.Error }),
          deposit({ id: "d:0", status: DepositStatus.Refunded }),
        ],
      })

      const { result } = renderHook(() => usePendingReceiveAmount({}))

      expect(result.current.pendingReceiveAmountText).toBeNull()
    })

    it("returns null when there are no deposits", () => {
      const { result } = renderHook(() => usePendingReceiveAmount({}))

      expect(result.current.pendingReceiveAmountText).toBeNull()
    })

    it("ignores custodial pending transactions in self-custodial mode", () => {
      const { result } = renderHook(() =>
        usePendingReceiveAmount({ pendingIncomingTransactions: [pendingReceiveTx()] }),
      )

      expect(result.current.pendingReceiveAmountText).toBeNull()
    })
  })
})
