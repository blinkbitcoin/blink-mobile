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

type SendWallet = { id: string; walletCurrency: WalletCurrency; balance: number }

/** The wallets the send flow would offer, as its own hook answers them: the dollar
 *  wallet is already gone from the list when the dollar balance is gated. */
const mockSendWallets = {
  current: {
    wallets: [] as SendWallet[] | undefined,
    btcWallet: undefined as SendWallet | undefined,
    loading: false,
  },
}

jest.mock("@app/screens/send-bitcoin-screen/hooks/use-send-wallets", () => ({
  useSendWallets: () => mockSendWallets.current,
}))

const walletOf = (currency: WalletCurrency, amount: number): SendWallet => ({
  id: `wallet-${currency}`,
  walletCurrency: currency,
  balance: amount,
})

const offered = (...wallets: SendWallet[]) => {
  mockSendWallets.current = {
    wallets,
    btcWallet: wallets.find(
      ({ walletCurrency }) => walletCurrency === WalletCurrency.Btc,
    ),
    loading: false,
  }
}

describe("useInvestmentFunding", () => {
  beforeEach(() => {
    mockConvert.current = (moneyAmount) => ({ amount: centsFor(moneyAmount) })
    offered()
  })

  /**
   * A payment draws on one wallet, so what the fullest one holds is what decides whether
   * the investment can go through; adding the two together says yes to an investor the
   * send flow would turn away.
   */
  it("measures the investment against the fullest wallet, not the two added up", () => {
    offered(
      walletOf(WalletCurrency.Btc, 1_000_000), // $1,000
      walletOf(WalletCurrency.Usd, 250_000), // $2,500
    )

    const { result } = renderHook(() => useInvestmentFunding(25000))

    expect(result.current.balanceUsd).toBe(2500)
    expect(result.current.balanceCurrency).toBe(WalletCurrency.Usd)
    expect(result.current.balanceWalletId).toBe("wallet-USD")
    expect(result.current.shortfallUsd).toBe(22500)
    expect(result.current.hasEnoughBalance).toBe(false)
  })

  /** The shortfall names the wallet the balance came from, so it has to say which. */
  it("names the bitcoin wallet when that is the fullest", () => {
    offered(
      walletOf(WalletCurrency.Btc, 30_000_000), // $30,000
      walletOf(WalletCurrency.Usd, 250_000), // $2,500
    )

    const { result } = renderHook(() => useInvestmentFunding(50000))

    expect(result.current.balanceUsd).toBe(30000)
    expect(result.current.balanceCurrency).toBe(WalletCurrency.Btc)
    expect(result.current.balanceWalletId).toBe("wallet-BTC")
  })

  /**
   * Only what the send flow would offer counts. While the dollar balance is gated, the
   * send flow drops the dollar wallet, so a dollar balance that would cover the
   * investment is money the payment cannot draw on; counting it sent the investor into
   * a send flow that offered the bitcoin wallet alone and refused the amount.
   */
  it("counts only the wallets the send flow offers, not a gated dollar balance", () => {
    offered(walletOf(WalletCurrency.Btc, 200_000)) // $200; $30,000 in dollars is gated

    const { result } = renderHook(() => useInvestmentFunding(25000))

    expect(result.current.hasEnoughBalance).toBe(false)
    expect(result.current.isSplitAcrossWallets).toBe(false)
    expect(result.current.balanceUsd).toBe(200)
    expect(result.current.balanceCurrency).toBe(WalletCurrency.Btc)
    expect(result.current.balanceWalletId).toBe("wallet-BTC")
  })

  /** Held between the two but not in either: the answer is to consolidate, not to
   *  deposit, and the screen offers a different way out for each. */
  it("marks a balance that is only split across the two wallets", () => {
    offered(
      walletOf(WalletCurrency.Btc, 3_000_000), // $3,000
      walletOf(WalletCurrency.Usd, 300_000), // $3,000
    )

    const { result } = renderHook(() => useInvestmentFunding(5000))

    expect(result.current.hasEnoughBalance).toBe(false)
    expect(result.current.isSplitAcrossWallets).toBe(true)
  })

  it("is not split when neither wallet nor both together are enough", () => {
    offered(walletOf(WalletCurrency.Usd, 100_000))

    const { result } = renderHook(() => useInvestmentFunding(5000))

    expect(result.current.isSplitAcrossWallets).toBe(false)
  })

  it("reports the investment covered once the wallets hold enough", () => {
    offered(walletOf(WalletCurrency.Usd, 2_500_000))

    const { result } = renderHook(() => useInvestmentFunding(25000))

    expect(result.current.hasEnoughBalance).toBe(true)
    expect(result.current.shortfallUsd).toBe(0)
  })

  /** One wallet only: nothing can be split, and the fullest is the whole. */
  it("reads an account with one wallet as never split", () => {
    offered(walletOf(WalletCurrency.Btc, 3_000_000)) // $3,000

    const { result } = renderHook(() => useInvestmentFunding(5000))

    expect(result.current.balanceUsd).toBe(3000)
    expect(result.current.balanceCurrency).toBe(WalletCurrency.Btc)
    expect(result.current.isSplitAcrossWallets).toBe(false)
  })

  /** Two wallets holding the same amount: the first one listed is the one named, which
   *  is as good as any, and this pins that it is stable rather than arbitrary. */
  it("names the first of two equal wallets", () => {
    offered(
      walletOf(WalletCurrency.Usd, 250_000), // $2,500
      walletOf(WalletCurrency.Btc, 2_500_000), // $2,500
    )

    const { result } = renderHook(() => useInvestmentFunding(25000))

    expect(result.current.balanceUsd).toBe(2500)
    expect(result.current.balanceCurrency).toBe(WalletCurrency.Usd)
  })

  /** With nothing held the bitcoin wallet is named, as the one a deposit lands in. */
  it("answers an empty account as nothing held, in the bitcoin wallet", () => {
    const { result } = renderHook(() => useInvestmentFunding(25000))

    expect(result.current.balanceUsd).toBe(0)
    expect(result.current.balanceCurrency).toBe(WalletCurrency.Btc)
    expect(result.current.balanceWalletId).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
  })

  /** Two empty wallets: the bitcoin one is named, by id as well, as the one a deposit
   *  lands in and the one the send flow should open on. */
  it("names the empty bitcoin wallet by id when it is offered", () => {
    offered(walletOf(WalletCurrency.Usd, 0), walletOf(WalletCurrency.Btc, 0))

    const { result } = renderHook(() => useInvestmentFunding(25000))

    expect(result.current.balanceCurrency).toBe(WalletCurrency.Btc)
    expect(result.current.balanceWalletId).toBe("wallet-BTC")
  })

  /**
   * Once signed, the debt is the satoshis the agreement names, fixed at that moment's
   * rate; the dollars the investor chose no longer describe it. With bitcoin down since,
   * a wallet holding exactly those satoshis is worth less than the chosen dollars and
   * still pays the invoice in full.
   */
  it("counts a wallet holding the signed satoshis as covered, whatever they are worth now", () => {
    /** Signed at $125,000 per bitcoin: $25,000 came to 20,000,000 sats, worth $20,000 at
     *  today's $100,000. */
    const signedSats = 20_000_000
    offered(walletOf(WalletCurrency.Btc, signedSats))

    const { result } = renderHook(() => useInvestmentFunding(25000, signedSats))

    expect(result.current.hasEnoughBalance).toBe(true)
    expect(result.current.balanceUsd).toBe(20000)
    expect(result.current.shortfallUsd).toBe(0)
  })

  /** With bitcoin up since signing, the chosen dollars no longer buy the satoshis owed,
   *  and a payment attempted on them would fail. */
  it("counts the chosen dollars as short once they no longer buy the signed satoshis", () => {
    /** Signed at $80,000 per bitcoin: $25,000 came to 31,250,000 sats, worth $31,250 at
     *  today's $100,000. */
    const signedSats = 31_250_000
    offered(walletOf(WalletCurrency.Usd, 2_500_000))

    const { result } = renderHook(() => useInvestmentFunding(25000, signedSats))

    expect(result.current.hasEnoughBalance).toBe(false)
    expect(result.current.shortfallUsd).toBe(6250)
  })

  it("measures against the chosen dollars while nothing is signed", () => {
    offered(walletOf(WalletCurrency.Usd, 2_500_000))

    const { result } = renderHook(() => useInvestmentFunding(25000, undefined))

    expect(result.current.hasEnoughBalance).toBe(true)
    expect(result.current.shortfallUsd).toBe(0)
  })

  /**
   * Before the price answers the balance reads as zero, which would say the investment is
   * not covered when it may well be. The flag is what keeps a caller from acting on it.
   */
  it("is loading until the price feed answers", () => {
    mockConvert.current = null
    offered(walletOf(WalletCurrency.Usd, 2_500_000))

    const { result } = renderHook(() => useInvestmentFunding(25000))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.balanceUsd).toBe(0)
  })

  it("is loading until the send flow's wallets are ready", () => {
    mockSendWallets.current = { wallets: undefined, btcWallet: undefined, loading: true }

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
