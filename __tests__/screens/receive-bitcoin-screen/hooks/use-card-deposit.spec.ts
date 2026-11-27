import { it } from "@jest/globals"
import { act, renderHook } from "@testing-library/react-native"

import {
  CardCollateralDepositIntentStatus,
  CardCollateralDepositMethod,
} from "@app/graphql/generated"
import { PaymentRequestState } from "@app/screens/receive-bitcoin-screen/payment/index.types"
import { useCardDeposit } from "@app/screens/receive-bitcoin-screen/hooks/use-card-deposit"

import { flushEffects } from "../../../helpers/flush-effects"

const mockCreate = jest.fn()
const mockUseStatus = jest.fn()
jest.mock("@app/hooks/use-card-deposit-intent", () => ({
  useCardDepositIntentCreate: () => ({ create: mockCreate, loading: false }),
  useCardDepositIntentStatus: (intentId: string | undefined) => mockUseStatus(intentId),
}))

const mockUseCountdown = jest.fn()
jest.mock("@app/hooks/use-countdown", () => ({
  useCountdown: (expiresAt: Date | null) => mockUseCountdown(expiresAt),
}))

const EXPIRES_AT = "2026-11-26T20:00:00.000Z"

const intentFor = (
  destination: string,
  method: CardCollateralDepositMethod = CardCollateralDepositMethod.Lightning,
) => ({
  intent: {
    intentId: `intent-${destination}`,
    method,
    destination,
    expiresAt: EXPIRES_AT,
  },
})

const rateLimited = (retryAfterSeconds?: number) => ({
  error: {
    code: "RATE_LIMIT_EXCEEDED",
    message: "Rate limit exceeded",
    retryAfterSeconds,
  },
})

type Props = {
  method: CardCollateralDepositMethod
  amountSats: number
  isRequested: boolean
}

const LIGHTNING_PROPS: Props = {
  method: CardCollateralDepositMethod.Lightning,
  amountSats: 5000,
  isRequested: true,
}

const renderDeposit = (props: Props = LIGHTNING_PROPS) =>
  renderHook((current: Props) => useCardDeposit(current), { initialProps: props })

describe("useCardDeposit", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseStatus.mockReturnValue({
      status: undefined,
      creditedSats: undefined,
      isFinal: false,
    })
    mockUseCountdown.mockReturnValue({ remainingSeconds: null, isExpired: false })
  })

  it("mints nothing and waits while no amount is set", async () => {
    const { result } = renderDeposit({ ...LIGHTNING_PROPS, amountSats: 0 })
    await flushEffects()

    expect(mockCreate).not.toHaveBeenCalled()
    expect(result.current.state).toBe(PaymentRequestState.Idle)
    expect(result.current.destination).toBeUndefined()
  })

  it("mints nothing until the deposit is asked for", async () => {
    const { result } = renderDeposit({ ...LIGHTNING_PROPS, isRequested: false })
    await flushEffects()

    expect(mockCreate).not.toHaveBeenCalled()
    expect(result.current.state).toBe(PaymentRequestState.Idle)
  })

  it("loads while blink-card mints, then shows what it minted", async () => {
    mockCreate.mockResolvedValue(intentFor("lnbc5000"))

    const { result } = renderDeposit()

    expect(result.current.state).toBe(PaymentRequestState.Loading)
    await flushEffects()

    expect(mockCreate).toHaveBeenCalledWith(5000, CardCollateralDepositMethod.Lightning)
    expect(result.current.state).toBe(PaymentRequestState.Created)
    expect(result.current.destination).toBe("lnbc5000")
    expect(mockUseStatus).toHaveBeenLastCalledWith("intent-lnbc5000")
  })

  it("fails with blink-card's error when the mint is refused", async () => {
    const error = { code: "TOO_MANY_PENDING_DEPOSIT_INTENTS", message: "Too many" }
    mockCreate.mockResolvedValue({ error })

    const { result } = renderDeposit()
    await flushEffects()

    expect(result.current.state).toBe(PaymentRequestState.Error)
    expect(result.current.error).toEqual(error)
  })

  it("mints a new deposit for a new amount and drops the answer for the old one", async () => {
    let resolveFirst: (value: ReturnType<typeof intentFor>) => void = () => undefined
    mockCreate
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
      )
      .mockResolvedValueOnce(intentFor("lnbc7000"))

    const { result, rerender } = renderDeposit()
    rerender({ ...LIGHTNING_PROPS, amountSats: 7000 })
    await flushEffects()

    await act(async () => {
      resolveFirst(intentFor("lnbc5000"))
    })

    expect(mockCreate).toHaveBeenLastCalledWith(
      7000,
      CardCollateralDepositMethod.Lightning,
    )
    expect(result.current.destination).toBe("lnbc7000")
  })

  it("mints again when asked to regenerate", async () => {
    mockCreate
      .mockResolvedValueOnce(intentFor("lnbc-first"))
      .mockResolvedValueOnce(intentFor("lnbc-second"))

    const { result } = renderDeposit()
    await flushEffects()

    act(() => result.current.regenerate())
    await flushEffects()

    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(result.current.destination).toBe("lnbc-second")
  })

  describe("when blink-card asks to wait before minting again", () => {
    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ["setImmediate"] })
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it("keeps loading and mints again once the wait it names is over", async () => {
      mockCreate
        .mockResolvedValueOnce(rateLimited(12))
        .mockResolvedValueOnce(intentFor("lnbc5000"))

      const { result } = renderDeposit()
      await flushEffects()

      expect(result.current.state).toBe(PaymentRequestState.Loading)
      act(() => jest.advanceTimersByTime(11_000))
      expect(mockCreate).toHaveBeenCalledTimes(1)

      act(() => jest.advanceTimersByTime(1_000))
      await flushEffects()

      expect(mockCreate).toHaveBeenCalledTimes(2)
      expect(result.current.state).toBe(PaymentRequestState.Created)
    })

    it("waits blink-card's default cooldown when the wait is not named", async () => {
      mockCreate
        .mockResolvedValueOnce(rateLimited())
        .mockResolvedValueOnce(intentFor("lnbc5000"))

      renderDeposit()
      await flushEffects()

      act(() => jest.advanceTimersByTime(29_000))
      expect(mockCreate).toHaveBeenCalledTimes(1)

      act(() => jest.advanceTimersByTime(1_000))
      await flushEffects()
      expect(mockCreate).toHaveBeenCalledTimes(2)
    })

    it("stops waiting when the screen is gone", async () => {
      mockCreate.mockResolvedValue(rateLimited(5))

      const { unmount } = renderDeposit()
      await flushEffects()
      unmount()

      act(() => jest.advanceTimersByTime(5_000))
      expect(mockCreate).toHaveBeenCalledTimes(1)
    })
  })

  describe("where the deposit stands", () => {
    beforeEach(() => {
      mockCreate.mockResolvedValue(intentFor("lnbc5000"))
    })

    it.each([
      [CardCollateralDepositIntentStatus.Pending, PaymentRequestState.Created],
      [CardCollateralDepositIntentStatus.Processing, PaymentRequestState.Converting],
      [CardCollateralDepositIntentStatus.Consumed, PaymentRequestState.Paid],
      [CardCollateralDepositIntentStatus.Expired, PaymentRequestState.Expired],
      [CardCollateralDepositIntentStatus.Failed, PaymentRequestState.Error],
    ])("reads %s as %s", async (status, state) => {
      mockUseStatus.mockReturnValue({ status, creditedSats: null, isFinal: false })

      const { result } = renderDeposit()
      await flushEffects()

      expect(result.current.state).toBe(state)
    })

    it("passes on the sats blink-card credited", async () => {
      mockUseStatus.mockReturnValue({
        status: CardCollateralDepositIntentStatus.Consumed,
        creditedSats: 4980,
        isFinal: true,
      })

      const { result } = renderDeposit()
      await flushEffects()

      expect(result.current.creditedSats).toBe(4980)
    })
  })

  describe("expiry", () => {
    it("counts a Lightning invoice down and reads it as expired at zero", async () => {
      mockCreate.mockResolvedValue(intentFor("lnbc5000"))
      mockUseCountdown.mockReturnValue({ remainingSeconds: 0, isExpired: true })

      const { result } = renderDeposit()
      await flushEffects()

      expect(mockUseCountdown).toHaveBeenLastCalledWith(new Date(EXPIRES_AT))
      expect(result.current.state).toBe(PaymentRequestState.Expired)
      expect(result.current.expiresInSeconds).toBe(0)
    })

    it("never counts an on-chain address down, since a late payment is still credited", async () => {
      mockCreate.mockResolvedValue(
        intentFor("tb1qcard", CardCollateralDepositMethod.Onchain),
      )

      const { result } = renderDeposit({
        ...LIGHTNING_PROPS,
        method: CardCollateralDepositMethod.Onchain,
      })
      await flushEffects()

      expect(mockUseCountdown).toHaveBeenLastCalledWith(null)
      expect(result.current.state).toBe(PaymentRequestState.Created)
    })
  })
})
