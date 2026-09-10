import { renderHook } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { useInvestmentFunding } from "@app/screens/card-screen/onboarding/investment-flow/use-investment-funding"

/** A round $100,000 per bitcoin: a satoshi is a tenth of a cent, which keeps the sums
 *  below readable. Wallet amounts are integers in their currency's minor unit. */
const SATS_PER_CENT = 10

const centsFor = (moneyAmount: { amount: number; currency: WalletCurrency }): number =>
  moneyAmount.currency === WalletCurrency.Btc
    ? moneyAmount.amount / SATS_PER_CENT
    : moneyAmount.amount

const mockConvert = {
  current: null as
    | null
    | ((amount: { amount: number; currency: WalletCurrency }) => { amount: number }),
}

jest.mock("@app/hooks", () => ({
  ...jest.requireActual("@app/hooks"),
  usePriceConversion: () => ({ convertMoneyAmount: mockConvert.current }),
}))

const mockActiveWallet = {
  current: { wallets: [] as unknown[], isReady: true },
}

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockActiveWallet.current,
}))

const walletOf = (currency: WalletCurrency, amount: number) => ({
  id: `wallet-${currency}`,
  walletCurrency: currency,
  balance: { amount, currency },
  transactions: [],
})

describe("useInvestmentFunding", () => {
  beforeEach(() => {
    mockConvert.current = (moneyAmount) => ({ amount: centsFor(moneyAmount) })
    mockActiveWallet.current = { wallets: [], isReady: true }
  })

  /** The flow tells the investor the money may sit in either wallet, so the check has to
   *  count both rather than the one they happen to be looking at. */
  it("counts both wallets towards the investment", () => {
    mockActiveWallet.current = {
      wallets: [
        walletOf(WalletCurrency.Btc, 1_000_000), // $1,000
        walletOf(WalletCurrency.Usd, 250_000), // $2,500
      ],
      isReady: true,
    }

    const { result } = renderHook(() => useInvestmentFunding(25000))

    expect(result.current.balanceUsd).toBe(3500)
    expect(result.current.shortfallUsd).toBe(21500)
    expect(result.current.hasEnoughBalance).toBe(false)
  })

  it("reports the investment covered once the wallets hold enough", () => {
    mockActiveWallet.current = {
      wallets: [walletOf(WalletCurrency.Usd, 2_500_000)],
      isReady: true,
    }

    const { result } = renderHook(() => useInvestmentFunding(25000))

    expect(result.current.hasEnoughBalance).toBe(true)
    expect(result.current.shortfallUsd).toBe(0)
  })

  it("answers an empty account as nothing held", () => {
    const { result } = renderHook(() => useInvestmentFunding(25000))

    expect(result.current.balanceUsd).toBe(0)
    expect(result.current.isLoading).toBe(false)
  })

  /**
   * Before the price answers the balance reads as zero, which would say the investment is
   * not covered when it may well be. The flag is what keeps a caller from acting on it.
   */
  it("is loading until the price feed answers", () => {
    mockConvert.current = null
    mockActiveWallet.current = {
      wallets: [walletOf(WalletCurrency.Usd, 2_500_000)],
      isReady: true,
    }

    const { result } = renderHook(() => useInvestmentFunding(25000))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.balanceUsd).toBe(0)
  })

  it("is loading until the account's wallets are ready", () => {
    mockActiveWallet.current = { wallets: [], isReady: false }

    const { result } = renderHook(() => useInvestmentFunding(25000))

    expect(result.current.isLoading).toBe(true)
  })
})
