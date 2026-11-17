import { renderHook, act } from "@testing-library/react-hooks"

import {
  TxDirection,
  WalletCurrency,
  type TransactionFragment,
} from "@app/graphql/generated"
import { useIncomingBadgeAutoSeen } from "@app/components/unseen-tx-amount-badge/use-incoming-badge-auto-seen"

const EXIT_ANIMATION_MS = 180

const tx = (overrides: Partial<TransactionFragment>): TransactionFragment =>
  ({
    __typename: "Transaction",
    id: "txid",
    status: "SUCCESS",
    createdAt: 0,
    direction: TxDirection.Receive,
    settlementAmount: 123,
    settlementFee: 0,
    settlementDisplayFee: "",
    settlementCurrency: WalletCurrency.Btc,
    settlementDisplayAmount: "",
    settlementDisplayCurrency: "",
    ...overrides,
  }) as TransactionFragment

type AutoSeenProps = {
  isFocused: boolean
  isOutgoing: boolean | undefined
  tx?: TransactionFragment
  amountText: string | null
  delayMs?: number
  markTxSeen: (currency: WalletCurrency) => void
}

describe("useIncomingBadgeAutoSeen", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const defaultProps = {
    isFocused: true,
    isOutgoing: false,
    tx: tx({}),
    amountText: "+BTC 123",
    delayMs: 5000,
    markTxSeen: jest.fn(),
  }

  it("marks the transaction seen as soon as the badge is announced", () => {
    const markTxSeen = jest.fn()
    const { result } = renderHook(() =>
      useIncomingBadgeAutoSeen({ ...defaultProps, markTxSeen }),
    )

    expect(markTxSeen).toHaveBeenCalledWith(WalletCurrency.Btc)
    expect(markTxSeen).toHaveBeenCalledTimes(1)
    expect(result.current.visible).toBe(true)
  })

  it("keeps the announcement while the badge is on screen and releases it after the exit animation", () => {
    const markTxSeen = jest.fn()
    const { result } = renderHook(() =>
      useIncomingBadgeAutoSeen({ ...defaultProps, markTxSeen }),
    )

    expect(result.current.announcement).toEqual({
      txId: "txid",
      currency: WalletCurrency.Btc,
      amountText: "+BTC 123",
    })

    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(result.current.visible).toBe(false)
    expect(result.current.announcement).not.toBeNull()

    act(() => {
      jest.advanceTimersByTime(EXIT_ANIMATION_MS)
    })

    expect(result.current.announcement).toBeNull()
  })

  it("holds what it announced after the transaction stops being unseen", () => {
    const markTxSeen = jest.fn()
    const { result, rerender } = renderHook(
      (props: AutoSeenProps) => useIncomingBadgeAutoSeen(props),
      { initialProps: { ...defaultProps, markTxSeen } as AutoSeenProps },
    )

    /** What marking seen does to the caller: there is no unseen transaction left to
     *  derive the badge from, and the badge still has to finish its display. */
    rerender({
      ...defaultProps,
      tx: undefined,
      amountText: null,
      isOutgoing: undefined,
      markTxSeen,
    })

    expect(result.current.visible).toBe(true)
    expect(result.current.announcement?.amountText).toBe("+BTC 123")
    expect(result.current.announcement?.txId).toBe("txid")
  })

  it("announces the same transaction only once", () => {
    const markTxSeen = jest.fn()
    const { rerender } = renderHook(
      (props: AutoSeenProps) => useIncomingBadgeAutoSeen(props),
      { initialProps: { ...defaultProps, markTxSeen } as AutoSeenProps },
    )

    rerender({ ...defaultProps, tx: tx({}), markTxSeen })
    rerender({ ...defaultProps, tx: tx({}), markTxSeen })

    act(() => {
      jest.advanceTimersByTime(5000 + EXIT_ANIMATION_MS)
    })

    expect(markTxSeen).toHaveBeenCalledTimes(1)
  })

  it("announces a later transaction that arrives after the first one", () => {
    const markTxSeen = jest.fn()
    const { result, rerender } = renderHook(
      (props: AutoSeenProps) => useIncomingBadgeAutoSeen(props),
      { initialProps: { ...defaultProps, markTxSeen } as AutoSeenProps },
    )

    act(() => {
      jest.advanceTimersByTime(5000)
    })
    act(() => {
      jest.advanceTimersByTime(EXIT_ANIMATION_MS)
    })

    rerender({
      ...defaultProps,
      tx: tx({ id: "txid-2", settlementCurrency: WalletCurrency.Usd }),
      amountText: "+USD 5",
      markTxSeen,
    })

    expect(markTxSeen).toHaveBeenLastCalledWith(WalletCurrency.Usd)
    expect(markTxSeen).toHaveBeenCalledTimes(2)
    expect(result.current.announcement?.txId).toBe("txid-2")
  })

  it("does not overwrite a badge that is still on screen", () => {
    const markTxSeen = jest.fn()
    const { result, rerender } = renderHook(
      (props: AutoSeenProps) => useIncomingBadgeAutoSeen(props),
      { initialProps: { ...defaultProps, markTxSeen } as AutoSeenProps },
    )

    /** What marking the first one seen does when both wallets have something unseen: the
     *  second currency becomes the newest unseen transaction right away. */
    rerender({
      ...defaultProps,
      tx: tx({ id: "txid-2", settlementCurrency: WalletCurrency.Usd }),
      amountText: "+USD 5",
      markTxSeen,
    })

    expect(result.current.announcement?.txId).toBe("txid")
    expect(markTxSeen).toHaveBeenCalledTimes(1)

    act(() => {
      jest.advanceTimersByTime(5000)
    })
    act(() => {
      jest.advanceTimersByTime(EXIT_ANIMATION_MS)
    })

    expect(result.current.announcement?.txId).toBe("txid-2")
    expect(markTxSeen).toHaveBeenLastCalledWith(WalletCurrency.Usd)
  })

  it("does not announce outgoing transactions", () => {
    const markTxSeen = jest.fn()
    const { result } = renderHook(() =>
      useIncomingBadgeAutoSeen({ ...defaultProps, isOutgoing: true, markTxSeen }),
    )

    expect(markTxSeen).not.toHaveBeenCalled()
    expect(result.current.announcement).toBeNull()
  })

  it("does not announce when isOutgoing is undefined", () => {
    const markTxSeen = jest.fn()
    renderHook(() =>
      useIncomingBadgeAutoSeen({ ...defaultProps, isOutgoing: undefined, markTxSeen }),
    )

    expect(markTxSeen).not.toHaveBeenCalled()
  })

  it("does not announce when the screen is not focused", () => {
    const markTxSeen = jest.fn()
    renderHook(() =>
      useIncomingBadgeAutoSeen({ ...defaultProps, isFocused: false, markTxSeen }),
    )

    expect(markTxSeen).not.toHaveBeenCalled()
  })

  it("does not announce without a transaction", () => {
    const markTxSeen = jest.fn()
    renderHook(() =>
      useIncomingBadgeAutoSeen({ ...defaultProps, tx: undefined, markTxSeen }),
    )

    expect(markTxSeen).not.toHaveBeenCalled()
  })

  it("does not announce before the amount can be formatted", () => {
    const markTxSeen = jest.fn()
    const { result, rerender } = renderHook(
      (props: AutoSeenProps) => useIncomingBadgeAutoSeen(props),
      {
        initialProps: { ...defaultProps, amountText: null, markTxSeen } as AutoSeenProps,
      },
    )

    expect(markTxSeen).not.toHaveBeenCalled()

    rerender({ ...defaultProps, markTxSeen })

    expect(markTxSeen).toHaveBeenCalledWith(WalletCurrency.Btc)
    expect(result.current.announcement?.amountText).toBe("+BTC 123")
  })

  it("announces when the screen regains focus", () => {
    const markTxSeen = jest.fn()
    const { rerender } = renderHook(
      (props: AutoSeenProps) => useIncomingBadgeAutoSeen(props),
      {
        initialProps: { ...defaultProps, isFocused: false, markTxSeen } as AutoSeenProps,
      },
    )

    act(() => {
      jest.advanceTimersByTime(10000)
    })

    expect(markTxSeen).not.toHaveBeenCalled()

    rerender({ ...defaultProps, isFocused: true, markTxSeen })

    expect(markTxSeen).toHaveBeenCalledWith(WalletCurrency.Btc)
  })

  it("respects a custom delayMs for how long the badge stays up", () => {
    const markTxSeen = jest.fn()
    const { result } = renderHook(() =>
      useIncomingBadgeAutoSeen({ ...defaultProps, delayMs: 2000, markTxSeen }),
    )

    act(() => {
      jest.advanceTimersByTime(1999)
    })

    expect(result.current.visible).toBe(true)

    act(() => {
      jest.advanceTimersByTime(1)
    })

    expect(result.current.visible).toBe(false)
  })
})
