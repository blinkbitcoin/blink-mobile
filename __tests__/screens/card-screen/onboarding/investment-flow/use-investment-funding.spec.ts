import { renderHook } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import {
  useInvestmentFunding,
  useInvestmentSats,
} from "@app/screens/card-screen/onboarding/investment-flow/use-investment-funding"

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

  /**
   * A payment draws on one wallet, so what the fullest one holds is what decides whether
   * the investment can go through. Adding the two together said yes to an investor the
   * send flow then turned away.
   */
  it("measures the investment against the fullest wallet, not the two added up", () => {
    mockActiveWallet.current = {
      wallets: [
        walletOf(WalletCurrency.Btc, 1_000_000), // $1,000
        walletOf(WalletCurrency.Usd, 250_000), // $2,500
      ],
      isReady: true,
    }

    const { result } = renderHook(() => useInvestmentFunding(25000))

    expect(result.current.balanceUsd).toBe(2500)
    expect(result.current.balanceCurrency).toBe(WalletCurrency.Usd)
    expect(result.current.shortfallUsd).toBe(22500)
    expect(result.current.hasEnoughBalance).toBe(false)
  })

  /** The shortfall names the wallet the balance came from, so it has to say which. */
  it("names the bitcoin wallet when that is the fullest", () => {
    mockActiveWallet.current = {
      wallets: [
        walletOf(WalletCurrency.Btc, 30_000_000), // $30,000
        walletOf(WalletCurrency.Usd, 250_000), // $2,500
      ],
      isReady: true,
    }

    const { result } = renderHook(() => useInvestmentFunding(50000))

    expect(result.current.balanceUsd).toBe(30000)
    expect(result.current.balanceCurrency).toBe(WalletCurrency.Btc)
  })

  /** Held between the two but not in either: the answer is to consolidate, not to
   *  deposit, and the screen offers a different way out for each. */
  it("marks a balance that is only split across the two wallets", () => {
    mockActiveWallet.current = {
      wallets: [
        walletOf(WalletCurrency.Btc, 3_000_000), // $3,000
        walletOf(WalletCurrency.Usd, 300_000), // $3,000
      ],
      isReady: true,
    }

    const { result } = renderHook(() => useInvestmentFunding(5000))

    expect(result.current.hasEnoughBalance).toBe(false)
    expect(result.current.isSplitAcrossWallets).toBe(true)
  })

  it("is not split when neither wallet nor both together are enough", () => {
    mockActiveWallet.current = {
      wallets: [walletOf(WalletCurrency.Usd, 100_000)],
      isReady: true,
    }

    const { result } = renderHook(() => useInvestmentFunding(5000))

    expect(result.current.isSplitAcrossWallets).toBe(false)
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

  /** With nothing held the bitcoin wallet is named, as the one a deposit lands in. */
  it("answers an empty account as nothing held, in the bitcoin wallet", () => {
    const { result } = renderHook(() => useInvestmentFunding(25000))

    expect(result.current.balanceUsd).toBe(0)
    expect(result.current.balanceCurrency).toBe(WalletCurrency.Btc)
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

describe("useInvestmentSats", () => {
  beforeEach(() => {
    mockConvert.current = (moneyAmount) => ({ amount: centsFor(moneyAmount) })
  })

  /** An invoice is written in satoshis, so the chosen dollars are converted once, at
   *  today's price, for the step that writes it. */
  it("converts the chosen dollars to satoshis at today's price", () => {
    mockConvert.current = (moneyAmount) => ({
      amount:
        moneyAmount.currency === WalletCurrency.Usd
          ? moneyAmount.amount * SATS_PER_CENT
          : moneyAmount.amount,
    })

    const { result } = renderHook(() => useInvestmentSats(25000))

    expect(result.current).toBe(25_000_000)
  })

  it("is zero until the price feed answers", () => {
    mockConvert.current = null

    const { result } = renderHook(() => useInvestmentSats(25000))

    expect(result.current).toBe(0)
  })
})
