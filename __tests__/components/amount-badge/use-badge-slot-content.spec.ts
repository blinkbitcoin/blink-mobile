import { act, renderHook } from "@testing-library/react-native"

import { AMOUNT_BADGE_ANIMATION, useBadgeSlotContent } from "@app/components/amount-badge"

const renderSlot = (props: Parameters<typeof useBadgeSlotContent>[0]) =>
  renderHook((p: Parameters<typeof useBadgeSlotContent>[0]) => useBadgeSlotContent(p), {
    initialProps: props,
  })

describe("useBadgeSlotContent", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("gives the slot to the pending row when nothing transient is showing", () => {
    const { result } = renderSlot({ showUnseenBadge: false, hasPendingAmount: true })

    expect(result.current).toBe("pending")
  })

  it("leaves the slot empty when there is nothing to show", () => {
    const { result } = renderSlot({ showUnseenBadge: false, hasPendingAmount: false })

    expect(result.current).toBe("none")
  })

  it("lets the unseen-tx badge take the slot from the pending row", () => {
    const { result, rerender } = renderSlot({
      showUnseenBadge: false,
      hasPendingAmount: true,
    })

    act(() => {
      rerender({ showUnseenBadge: true, hasPendingAmount: true, unseenKey: "tx-1" })
    })

    expect(result.current).toBe("unseen")
  })

  /** Unmounting the transient badge the instant it hides cuts its drop-out
   *  animation and swaps the pending row in with a hard edit. */
  it("holds the slot for the exit animation after the unseen badge hides", () => {
    const { result, rerender } = renderSlot({
      showUnseenBadge: true,
      hasPendingAmount: true,
      unseenKey: "tx-1",
    })

    act(() => {
      rerender({ showUnseenBadge: false, hasPendingAmount: true, unseenKey: "tx-1" })
    })
    act(() => {
      jest.advanceTimersByTime(AMOUNT_BADGE_ANIMATION.durationOut - 1)
    })

    expect(result.current).toBe("unseen")

    act(() => {
      jest.advanceTimersByTime(2)
    })

    expect(result.current).toBe("pending")
  })

  /** The seen-state that drives the transient badge can stay stuck true (an
   *  unfocused screen never schedules its dismissal), which must not cost an
   *  unconfirmed deposit its slot forever. */
  it("takes the slot back once the hold window elapses, even if the badge never hides", () => {
    const { result } = renderSlot({
      showUnseenBadge: true,
      hasPendingAmount: true,
      unseenKey: "tx-1",
      holdMs: 5_000,
    })

    act(() => {
      jest.advanceTimersByTime(5_000)
    })

    expect(result.current).toBe("unseen")

    act(() => {
      jest.advanceTimersByTime(AMOUNT_BADGE_ANIMATION.durationOut + 1)
    })

    expect(result.current).toBe("pending")
  })

  /** Once the hold has handed the slot over, the transient badge finishing is not a
   *  new event: re-arming the window there would unmount the pending row and replay
   *  its entry animation, blanking the amount for the length of both. */
  it("keeps the pending row when the unseen badge hides after the hold elapsed", () => {
    const { result, rerender } = renderSlot({
      showUnseenBadge: true,
      hasPendingAmount: true,
      unseenKey: "tx-1",
      holdMs: 5_000,
    })

    act(() => {
      jest.advanceTimersByTime(6_000)
    })
    expect(result.current).toBe("pending")

    act(() => {
      rerender({
        showUnseenBadge: false,
        hasPendingAmount: true,
        unseenKey: "tx-1",
        holdMs: 5_000,
      })
    })

    expect(result.current).toBe("pending")

    act(() => {
      jest.advanceTimersByTime(AMOUNT_BADGE_ANIMATION.durationOut + 1)
    })

    expect(result.current).toBe("pending")
  })

  it("gives a newly arrived transaction a fresh hold window", () => {
    const { result, rerender } = renderSlot({
      showUnseenBadge: true,
      hasPendingAmount: true,
      unseenKey: "tx-1",
      holdMs: 5_000,
    })

    act(() => {
      jest.advanceTimersByTime(6_000)
    })
    expect(result.current).toBe("pending")

    act(() => {
      rerender({
        showUnseenBadge: true,
        hasPendingAmount: true,
        unseenKey: "tx-2",
        holdMs: 5_000,
      })
    })

    expect(result.current).toBe("unseen")
  })

  /** Nothing dismisses the pending row: it is the deposit's only signal until
   *  it confirms (blink-wip#937). */
  it("keeps the pending row indefinitely once it owns the slot", () => {
    const { result } = renderSlot({ showUnseenBadge: false, hasPendingAmount: true })

    act(() => {
      jest.advanceTimersByTime(5 * 60_000)
    })

    expect(result.current).toBe("pending")
  })
})
