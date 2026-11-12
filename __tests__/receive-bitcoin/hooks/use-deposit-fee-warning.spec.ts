import { it } from "@jest/globals"
import { renderHook } from "@testing-library/react-hooks"

import { WalletCurrency } from "@app/graphql/generated"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { useDepositFeeWarning } from "@app/screens/receive-bitcoin-screen/hooks/use-deposit-fee-warning"
import { ReceivePaymentRequestState } from "@app/screens/receive-bitcoin-screen/payment/request-state.types"
import { DisplayCurrency, MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"

loadLocale("en")
const LL = i18nObject("en")

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({ LL }),
}))

const mockRemoteConfig = {
  depositFeeWarningMultiplier: 10,
  onchainDepositMinimumSats: 5000,
}
jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockRemoteConfig,
}))

const SATS_PER_CENT = 10
const convertMoneyAmount = jest.fn(
  (amount: MoneyAmount<WalletOrDisplayCurrency>, currency: WalletOrDisplayCurrency) => ({
    amount: amount.currency === currency ? amount.amount : amount.amount * SATS_PER_CENT,
    currency,
    currencyCode: currency === WalletCurrency.Btc ? "SAT" : "USD",
  }),
)

const deposit = {
  minBankFee: "2500",
  minBankFeeThreshold: "1000000",
  tiers: [
    { maxAmount: "1000000", amount: "2500" },
    { maxAmount: null, amount: "5000" },
  ],
}

const requestState = (overrides = {}) =>
  ({
    convertMoneyAmount,
    feesInformation: { deposit },
    ...overrides,
  }) as unknown as ReceivePaymentRequestState

const sats = (amount: number) => ({
  amount,
  currency: WalletCurrency.Btc,
  currencyCode: "SAT",
})
const cents = (amount: number) => ({
  amount,
  currency: DisplayCurrency,
  currencyCode: "USD",
})

const BELOW_MINIMUM =
  "Amount is below the minimum deposit. Anything under 5,000 SAT will not arrive"
const ALL_CONSUMED = "Amount will be consumed by the deposit fee"
const CONSUMED = "2,500 SAT will be consumed by the deposit fee"

describe("useDepositFeeWarning", () => {
  beforeEach(() => {
    mockRemoteConfig.depositFeeWarningMultiplier = 10
    mockRemoteConfig.onchainDepositMinimumSats = 5000
  })

  it("gives no warning function off the onchain page or on self-custodial", () => {
    const { result } = renderHook(() => useDepositFeeWarning(requestState(), false))

    expect(result.current).toBeUndefined()
  })

  it.each([
    [0, undefined],
    [2500, BELOW_MINIMUM],
    [4999, BELOW_MINIMUM],
    [5000, CONSUMED],
    [24999, CONSUMED],
    [25000, undefined],
  ])("classifies %i sats", (amount, expected) => {
    const { result } = renderHook(() => useDepositFeeWarning(requestState(), true))

    expect(result.current?.(sats(amount))).toBe(expected)
  })

  it("checks a display-currency amount by its sats value", () => {
    const { result } = renderHook(() => useDepositFeeWarning(requestState(), true))

    expect(result.current?.(cents(499))).toBe(BELOW_MINIMUM)
    expect(result.current?.(cents(500))).toBe(CONSUMED)
    expect(result.current?.(cents(2500))).toBeUndefined()
  })

  it("narrows the warning band with the remote-config multiplier", () => {
    mockRemoteConfig.depositFeeWarningMultiplier = 3
    const { result } = renderHook(() => useDepositFeeWarning(requestState(), true))

    expect(result.current?.(sats(7499))).toBe(CONSUMED)
    expect(result.current?.(sats(7500))).toBeUndefined()
  })

  it("says the whole amount goes to the fee when the floor is under it", () => {
    mockRemoteConfig.onchainDepositMinimumSats = 1000
    const { result } = renderHook(() => useDepositFeeWarning(requestState(), true))

    expect(result.current?.(sats(999))).toBe(
      "Amount is below the minimum deposit. Anything under 1,000 SAT will not arrive",
    )
    expect(result.current?.(sats(1000))).toBe(ALL_CONSUMED)
    expect(result.current?.(sats(2500))).toBe(ALL_CONSUMED)
    expect(result.current?.(sats(2501))).toBe(CONSUMED)
  })

  it("states the backend fee, not a literal", () => {
    const { result } = renderHook(() =>
      useDepositFeeWarning(
        requestState({
          feesInformation: {
            deposit: { ...deposit, tiers: [{ maxAmount: null, amount: "3100" }] },
          },
        }),
        true,
      ),
    )

    expect(result.current?.(sats(5000))).toBe(
      "3,100 SAT will be consumed by the deposit fee",
    )
  })

  it("falls back to the default fee before feesInformation resolves", () => {
    const { result } = renderHook(() =>
      useDepositFeeWarning(requestState({ feesInformation: undefined }), true),
    )

    expect(result.current?.(sats(24999))).toBe(CONSUMED)
    expect(result.current?.(sats(25000))).toBeUndefined()
  })
})
