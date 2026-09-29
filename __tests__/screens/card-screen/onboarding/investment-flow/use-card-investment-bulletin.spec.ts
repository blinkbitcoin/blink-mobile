import { renderHook } from "@testing-library/react-native"

import { TxDirection, WalletCurrency } from "@app/graphql/generated"
import {
  PendingReceive,
  resolveCardInvestmentBulletin,
  useCardInvestmentBulletin,
} from "@app/screens/card-screen/onboarding/investment-flow/use-card-investment-bulletin"
import {
  CardInvestmentBulletinKind,
  CardInvestmentProgress,
} from "@app/types/card-investment"

const mockDismissWelcome = jest.fn()
const mockProgress: { current: CardInvestmentProgress | null } = { current: null }

jest.mock("@app/hooks/use-card-investment-progress", () => ({
  useCardInvestmentProgress: () => ({
    progress: mockProgress.current,
    dismissWelcome: mockDismissWelcome,
  }),
}))

/** A round $100,000 per bitcoin: a satoshi is a tenth of a cent. */
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

/** Its own spec covers how the balance is measured; here only the answer matters. */
const mockUseInvestmentFunding = jest.fn()

jest.mock(
  "@app/screens/card-screen/onboarding/investment-flow/use-investment-funding",
  () => ({
    useInvestmentFunding: (totalUsd: number, settlementSats?: number) =>
      mockUseInvestmentFunding(totalUsd, settlementSats),
  }),
)

const SIGNED: CardInvestmentProgress = {
  selectedAmountUsd: 25000,
  settlementSats: 31_704_000,
  signedAt: 1_757_700_000_000,
}
const PAYING: CardInvestmentProgress = { ...SIGNED, payingAt: 1_757_790_000_000 }
const PAID: CardInvestmentProgress = { ...SIGNED, paidAt: 1_757_800_000_000 }
const WELCOMED: CardInvestmentProgress = {
  ...PAID,
  welcomeDismissedAt: 1_757_900_000_000,
}

const dismiss = () => {}

const resolve = (
  overrides: Partial<Parameters<typeof resolveCardInvestmentBulletin>[0]> = {},
) =>
  resolveCardInvestmentBulletin({
    progress: SIGNED,
    hasEnoughBalance: false,
    isSplitAcrossWallets: false,
    isFundingLoading: false,
    balanceUsd: 0,
    owedUsd: 25000,
    pendingDepositUsd: 0,
    dismiss,
    ...overrides,
  })

describe("resolveCardInvestmentBulletin", () => {
  it("says nothing when no investment was signed", () => {
    expect(resolve({ progress: null })).toBeNull()
  })

  it("welcomes the investor once the investment is paid, whatever the balance", () => {
    expect(resolve({ progress: PAID, hasEnoughBalance: false })?.kind).toBe(
      CardInvestmentBulletinKind.Shareholder,
    )
    expect(resolve({ progress: PAID, isFundingLoading: true })?.kind).toBe(
      CardInvestmentBulletinKind.Shareholder,
    )
  })

  /** The record stays as the mark that this account has signed; the card does not. */
  it("says nothing once the welcome has been closed", () => {
    expect(resolve({ progress: WELCOMED })).toBeNull()
    expect(resolve({ progress: WELCOMED, hasEnoughBalance: true })).toBeNull()
  })

  /** The money has left the wallet; asking for it again would have the investor pay
   *  twice, so the card waits, whatever the balance now reads. */
  it("says the payment is on its way while it is, whatever the balance", () => {
    expect(resolve({ progress: PAYING })?.kind).toBe(
      CardInvestmentBulletinKind.PaymentPending,
    )
    expect(resolve({ progress: PAYING, hasEnoughBalance: true })?.kind).toBe(
      CardInvestmentBulletinKind.PaymentPending,
    )
    expect(resolve({ progress: PAYING, isFundingLoading: true })?.kind).toBe(
      CardInvestmentBulletinKind.PaymentPending,
    )
  })

  /** A zero mid-load reads as a shortfall; the investor may well be covered. */
  it("says nothing while the balance is still unknown", () => {
    expect(resolve({ isFundingLoading: true })).toBeNull()
    expect(resolve({ isFundingLoading: true, pendingDepositUsd: 25000 })).toBeNull()
    expect(resolve({ isFundingLoading: true, isSplitAcrossWallets: true })).toBeNull()
  })

  it("sends the investor back to pay once the balance covers it", () => {
    expect(resolve({ hasEnoughBalance: true })?.kind).toBe(
      CardInvestmentBulletinKind.Ready,
    )
  })

  /** Money already in hand outranks money on its way: it is what can be acted on now. */
  it("prefers paying over waiting when a deposit is pending but the balance covers it", () => {
    expect(resolve({ hasEnoughBalance: true, pendingDepositUsd: 25000 })?.kind).toBe(
      CardInvestmentBulletinKind.Ready,
    )
  })

  /** Asking for a deposit would ask for money the investor already holds. */
  it("asks the investor to convert when the money is spread over both wallets", () => {
    expect(resolve({ isSplitAcrossWallets: true })?.kind).toBe(
      CardInvestmentBulletinKind.SplitFunds,
    )
  })

  it("prefers converting over waiting when funds are split and a deposit is pending", () => {
    expect(resolve({ isSplitAcrossWallets: true, pendingDepositUsd: 25000 })?.kind).toBe(
      CardInvestmentBulletinKind.SplitFunds,
    )
  })

  it("asks the investor to wait while a deposit that covers the gap is on its way", () => {
    expect(resolve({ pendingDepositUsd: 25000 })?.kind).toBe(
      CardInvestmentBulletinKind.DepositPending,
    )
    expect(resolve({ balanceUsd: 20000, pendingDepositUsd: 5000 })?.kind).toBe(
      CardInvestmentBulletinKind.DepositPending,
    )
  })

  /** A deposit that would not close the gap leaves the investor with a card that says
   *  to wait and nothing to wait for; the shortfall is what they need to hear about. */
  it("asks for the money when the deposit on its way would still leave it short", () => {
    expect(resolve({ balanceUsd: 20000, pendingDepositUsd: 4999 })?.kind).toBe(
      CardInvestmentBulletinKind.Insufficient,
    )
    expect(resolve({ pendingDepositUsd: 100 })?.kind).toBe(
      CardInvestmentBulletinKind.Insufficient,
    )
  })

  it("asks for the money when it is short and nothing is on its way", () => {
    expect(resolve()?.kind).toBe(CardInvestmentBulletinKind.Insufficient)
  })

  it("carries the investment and the dismissal with every answer", () => {
    const bulletin = resolve()

    expect(bulletin?.progress).toBe(SIGNED)
    expect(bulletin?.dismiss).toBe(dismiss)
  })
})

describe("useCardInvestmentBulletin", () => {
  const funding = (overrides: Record<string, unknown> = {}) => ({
    hasEnoughBalance: false,
    isSplitAcrossWallets: false,
    isLoading: false,
    balanceUsd: 0,
    owedUsd: 25000,
    ...overrides,
  })
  const receive = (
    settlementAmount: number,
    settlementCurrency: WalletCurrency,
    direction: TxDirection = TxDirection.Receive,
  ): PendingReceive => ({ direction, settlementAmount, settlementCurrency })

  beforeEach(() => {
    jest.clearAllMocks()
    mockProgress.current = SIGNED
    mockConvert.current = (moneyAmount) => ({ amount: centsFor(moneyAmount) })
    mockUseInvestmentFunding.mockReturnValue(funding())
  })

  it("measures the balance against what the investor signed for, satoshis included", () => {
    renderHook(() => useCardInvestmentBulletin({ pendingReceives: [] }))

    expect(mockUseInvestmentFunding).toHaveBeenCalledWith(
      SIGNED.selectedAmountUsd,
      SIGNED.settlementSats,
    )
  })

  /** Hooks cannot be skipped, so with nothing signed the balance is measured against
   *  nothing; the answer is discarded either way. */
  it("measures against zero and says nothing when no investment was signed", () => {
    mockProgress.current = null

    const { result } = renderHook(() =>
      useCardInvestmentBulletin({
        pendingReceives: [receive(25_000_000, WalletCurrency.Btc)],
      }),
    )

    expect(mockUseInvestmentFunding).toHaveBeenCalledWith(0, undefined)
    expect(result.current).toBeNull()
  })

  it("answers Ready when the balance covers the investment", () => {
    mockUseInvestmentFunding.mockReturnValue(funding({ hasEnoughBalance: true }))

    const { result } = renderHook(() =>
      useCardInvestmentBulletin({ pendingReceives: [] }),
    )

    expect(result.current?.kind).toBe(CardInvestmentBulletinKind.Ready)
  })

  it("answers SplitFunds when the money is spread over both wallets", () => {
    mockUseInvestmentFunding.mockReturnValue(funding({ isSplitAcrossWallets: true }))

    const { result } = renderHook(() =>
      useCardInvestmentBulletin({ pendingReceives: [] }),
    )

    expect(result.current?.kind).toBe(CardInvestmentBulletinKind.SplitFunds)
  })

  /** The receives come in either currency and are priced at today's rate: $20,000 held,
   *  $5,000 on its way in bitcoin, and the $25,000 owed is covered. */
  it("answers DepositPending when the receives on their way would close the gap", () => {
    mockUseInvestmentFunding.mockReturnValue(funding({ balanceUsd: 20000 }))

    const { result } = renderHook(() =>
      useCardInvestmentBulletin({
        pendingReceives: [receive(5_000_000, WalletCurrency.Btc)],
      }),
    )

    expect(result.current?.kind).toBe(CardInvestmentBulletinKind.DepositPending)
  })

  /** Several small receives are summed after each is priced, so none is lost to
   *  rounding on its own. */
  it("adds up every receive on its way, in both currencies", () => {
    mockUseInvestmentFunding.mockReturnValue(funding({ balanceUsd: 20000 }))

    const { result } = renderHook(() =>
      useCardInvestmentBulletin({
        pendingReceives: [
          receive(2_000_000, WalletCurrency.Btc),
          receive(300_000, WalletCurrency.Usd),
        ],
      }),
    )

    expect(result.current?.kind).toBe(CardInvestmentBulletinKind.DepositPending)
  })

  it("answers Insufficient when the receives on their way would leave it short", () => {
    mockUseInvestmentFunding.mockReturnValue(funding({ balanceUsd: 20000 }))

    const { result } = renderHook(() =>
      useCardInvestmentBulletin({
        pendingReceives: [receive(4_000_000, WalletCurrency.Btc)],
      }),
    )

    expect(result.current?.kind).toBe(CardInvestmentBulletinKind.Insufficient)
  })

  /** A payment still confirming on its way out is not money coming in. */
  it("does not count a pending send as a deposit", () => {
    mockUseInvestmentFunding.mockReturnValue(funding({ balanceUsd: 20000 }))

    const { result } = renderHook(() =>
      useCardInvestmentBulletin({
        pendingReceives: [receive(5_000_000, WalletCurrency.Btc, TxDirection.Send)],
      }),
    )

    expect(result.current?.kind).toBe(CardInvestmentBulletinKind.Insufficient)
  })

  it("answers Insufficient when nothing is on its way", () => {
    const { result } = renderHook(() =>
      useCardInvestmentBulletin({ pendingReceives: undefined }),
    )

    expect(result.current?.kind).toBe(CardInvestmentBulletinKind.Insufficient)
  })

  /** Before the price answers the receives cannot be priced; the funding hook is
   *  loading in the same moment, which already holds the card. */
  it("counts nothing on its way before the price answers", () => {
    mockConvert.current = null
    mockUseInvestmentFunding.mockReturnValue(funding({ isLoading: true }))

    const { result } = renderHook(() =>
      useCardInvestmentBulletin({
        pendingReceives: [receive(25_000_000, WalletCurrency.Btc)],
      }),
    )

    expect(result.current).toBeNull()
  })

  it("answers nothing while the balance is loading", () => {
    mockUseInvestmentFunding.mockReturnValue(funding({ isLoading: true }))

    const { result } = renderHook(() =>
      useCardInvestmentBulletin({ pendingReceives: [] }),
    )

    expect(result.current).toBeNull()
  })

  it("answers PaymentPending while the payment is on its way", () => {
    mockProgress.current = PAYING

    const { result } = renderHook(() =>
      useCardInvestmentBulletin({ pendingReceives: [] }),
    )

    expect(result.current?.kind).toBe(CardInvestmentBulletinKind.PaymentPending)
  })

  it("answers Shareholder once the investment is paid", () => {
    mockProgress.current = PAID

    const { result } = renderHook(() =>
      useCardInvestmentBulletin({ pendingReceives: [] }),
    )

    expect(result.current?.kind).toBe(CardInvestmentBulletinKind.Shareholder)
  })

  /** Closing the welcome keeps the record: it is what says this account has signed. */
  it("dismisses by closing the welcome, not by forgetting the investment", () => {
    mockProgress.current = PAID

    const { result } = renderHook(() =>
      useCardInvestmentBulletin({ pendingReceives: [] }),
    )
    result.current?.dismiss()

    expect(mockDismissWelcome).toHaveBeenCalledTimes(1)
  })
})
