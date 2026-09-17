import { renderHook } from "@testing-library/react-native"

import {
  resolveCardInvestmentBulletin,
  useCardInvestmentBulletin,
} from "@app/screens/card-screen/onboarding/investment-flow/use-card-investment-bulletin"
import {
  CardInvestmentBulletinKind,
  CardInvestmentProgress,
} from "@app/types/card-investment"

const mockClear = jest.fn()
const mockProgress: { current: CardInvestmentProgress | null } = { current: null }
const mockIsInvited = { current: false }

jest.mock("@app/hooks/use-card-investment-progress", () => ({
  useCardInvestmentProgress: () => ({
    progress: mockProgress.current,
    isInvited: mockIsInvited.current,
    clear: mockClear,
  }),
}))

/** Its own spec covers how the balance is measured; here only the answer matters. */
const mockUseInvestmentFunding = jest.fn()

jest.mock(
  "@app/screens/card-screen/onboarding/investment-flow/use-investment-funding",
  () => ({
    useInvestmentFunding: (totalUsd: number) => mockUseInvestmentFunding(totalUsd),
  }),
)

const SIGNED: CardInvestmentProgress = {
  selectedAmountUsd: 25000,
  settlementSats: 31_704_000,
}
const PAID: CardInvestmentProgress = { ...SIGNED, paidAt: 1_757_800_000_000 }

const dismiss = () => {}

const resolve = (
  overrides: Partial<Parameters<typeof resolveCardInvestmentBulletin>[0]> = {},
) =>
  resolveCardInvestmentBulletin({
    progress: SIGNED,
    isInvited: false,
    hasEnoughBalance: false,
    isSplitAcrossWallets: false,
    isFundingLoading: false,
    hasPendingDeposit: false,
    dismiss,
    ...overrides,
  })

describe("resolveCardInvestmentBulletin", () => {
  it("says nothing when the invitation was never opened", () => {
    expect(resolve({ progress: null })).toBeNull()
  })

  /** The way back into a flow left before signing, whatever the balance says. */
  it("holds the invitation open until the agreement is signed", () => {
    expect(resolve({ progress: null, isInvited: true })?.kind).toBe(
      CardInvestmentBulletinKind.Invited,
    )
    expect(
      resolve({ progress: null, isInvited: true, isFundingLoading: true })?.kind,
    ).toBe(CardInvestmentBulletinKind.Invited)
    expect(
      resolve({ progress: null, isInvited: true, hasEnoughBalance: true })?.kind,
    ).toBe(CardInvestmentBulletinKind.Invited)
  })

  it("carries no investment with the invitation", () => {
    expect(resolve({ progress: null, isInvited: true })?.progress).toBeNull()
  })

  it("welcomes the investor once the investment is paid, whatever the balance", () => {
    expect(resolve({ progress: PAID, hasEnoughBalance: false })?.kind).toBe(
      CardInvestmentBulletinKind.Shareholder,
    )
    expect(resolve({ progress: PAID, isFundingLoading: true })?.kind).toBe(
      CardInvestmentBulletinKind.Shareholder,
    )
  })

  /** A zero mid-load reads as a shortfall; the investor may well be covered. */
  it("says nothing while the balance is still unknown", () => {
    expect(resolve({ isFundingLoading: true })).toBeNull()
    expect(resolve({ isFundingLoading: true, hasPendingDeposit: true })).toBeNull()
    expect(resolve({ isFundingLoading: true, isSplitAcrossWallets: true })).toBeNull()
  })

  it("sends the investor back to pay once the balance covers it", () => {
    expect(resolve({ hasEnoughBalance: true })?.kind).toBe(
      CardInvestmentBulletinKind.Ready,
    )
  })

  /** Money already in hand outranks money on its way: it is what can be acted on now. */
  it("prefers paying over waiting when a deposit is pending but the balance covers it", () => {
    expect(resolve({ hasEnoughBalance: true, hasPendingDeposit: true })?.kind).toBe(
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
    expect(resolve({ isSplitAcrossWallets: true, hasPendingDeposit: true })?.kind).toBe(
      CardInvestmentBulletinKind.SplitFunds,
    )
  })

  it("asks the investor to wait while a deposit is on its way", () => {
    expect(resolve({ hasPendingDeposit: true })?.kind).toBe(
      CardInvestmentBulletinKind.DepositPending,
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
    ...overrides,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockProgress.current = SIGNED
    mockIsInvited.current = false
    mockUseInvestmentFunding.mockReturnValue(funding())
  })

  it("answers Invited while the invitation is open and nothing is signed", () => {
    mockProgress.current = null
    mockIsInvited.current = true

    const { result } = renderHook(() =>
      useCardInvestmentBulletin({ hasPendingDeposit: false }),
    )

    expect(result.current?.kind).toBe(CardInvestmentBulletinKind.Invited)
  })

  it("measures the balance against the amount the investor signed for", () => {
    renderHook(() => useCardInvestmentBulletin({ hasPendingDeposit: false }))

    expect(mockUseInvestmentFunding).toHaveBeenCalledWith(SIGNED.selectedAmountUsd)
  })

  /** Hooks cannot be skipped, so with nothing signed the balance is measured against
   *  nothing; the answer is discarded either way. */
  it("measures against zero and says nothing when no investment was signed", () => {
    mockProgress.current = null

    const { result } = renderHook(() =>
      useCardInvestmentBulletin({ hasPendingDeposit: true }),
    )

    expect(mockUseInvestmentFunding).toHaveBeenCalledWith(0)
    expect(result.current).toBeNull()
  })

  it("answers Ready when the balance covers the investment", () => {
    mockUseInvestmentFunding.mockReturnValue(funding({ hasEnoughBalance: true }))

    const { result } = renderHook(() =>
      useCardInvestmentBulletin({ hasPendingDeposit: false }),
    )

    expect(result.current?.kind).toBe(CardInvestmentBulletinKind.Ready)
  })

  it("answers SplitFunds when the money is spread over both wallets", () => {
    mockUseInvestmentFunding.mockReturnValue(funding({ isSplitAcrossWallets: true }))

    const { result } = renderHook(() =>
      useCardInvestmentBulletin({ hasPendingDeposit: false }),
    )

    expect(result.current?.kind).toBe(CardInvestmentBulletinKind.SplitFunds)
  })

  it("answers DepositPending when short with a deposit on its way", () => {
    const { result } = renderHook(() =>
      useCardInvestmentBulletin({ hasPendingDeposit: true }),
    )

    expect(result.current?.kind).toBe(CardInvestmentBulletinKind.DepositPending)
  })

  it("answers nothing while the balance is loading", () => {
    mockUseInvestmentFunding.mockReturnValue(funding({ isLoading: true }))

    const { result } = renderHook(() =>
      useCardInvestmentBulletin({ hasPendingDeposit: false }),
    )

    expect(result.current).toBeNull()
  })

  it("answers Shareholder once the investment is paid", () => {
    mockProgress.current = PAID

    const { result } = renderHook(() =>
      useCardInvestmentBulletin({ hasPendingDeposit: false }),
    )

    expect(result.current?.kind).toBe(CardInvestmentBulletinKind.Shareholder)
  })

  it("dismisses by forgetting the investment", () => {
    mockProgress.current = PAID

    const { result } = renderHook(() =>
      useCardInvestmentBulletin({ hasPendingDeposit: false }),
    )
    result.current?.dismiss()

    expect(mockClear).toHaveBeenCalledTimes(1)
  })
})
