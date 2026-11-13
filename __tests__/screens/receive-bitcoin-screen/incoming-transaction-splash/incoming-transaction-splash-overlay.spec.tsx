import React from "react"
import { AccessibilityInfo, Modal, Platform } from "react-native"
import ReactNativeHapticFeedback from "react-native-haptic-feedback"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { it } from "@jest/globals"

import { TxDirection, WalletCurrency } from "@app/graphql/generated"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { IncomingTransactionSplashOverlay } from "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/incoming-transaction-splash-overlay"
import type { ShownSplash } from "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/incoming-transaction-splash-provider"

import { ContextForScreen } from "../../helper"

/** Every timing that reports back is held here and finished by hand, in order. */
const mockFinishers: Array<(finished: boolean) => void> = []
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  ...jest.requireActual("react-native-reanimated"),
  withTiming: (
    toValue: number,
    _config?: unknown,
    callback?: (finished: boolean) => void,
  ) => {
    if (callback) mockFinishers.push(callback)
    return toValue
  },
  withDelay: (_delay: number, animation: unknown) => animation,
  // Styles are not under test, and the worklets carry no dependency array.
  useAnimatedStyle: () => ({}),
  useDerivedValue: () => ({ value: 0 }),
  runOnJS:
    (fn: (...args: unknown[]) => void) =>
    (...args: unknown[]) =>
      fn(...args),
}))

jest.mock("@shopify/react-native-skia", () => ({
  Canvas: () => null,
  Rect: () => null,
  RadialGradient: () => null,
  vec: (x: number, y: number) => ({ x, y }),
}))

jest.mock("react-native-screens", () => ({
  ...jest.requireActual("react-native-screens"),
  FullWindowOverlay: ({ children }: { children: React.ReactNode }) => children,
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatCurrency: ({ amountInMajorUnits }: { amountInMajorUnits: string }) =>
      `$${Number(amountInMajorUnits).toFixed(2)}`,
    formatMoneyAmount: ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
      `${moneyAmount.amount.toLocaleString("en-US")} SAT`,
  }),
}))

jest.mock("@app/components/success-glow", () => ({ SuccessGlow: () => null }))
jest.mock("@app/components/success-badge", () => ({ SuccessBadge: () => null }))

/** One frame: the iris waits a frame after the window is up. */
const FRAME_MS = 16

const NOW_S = Math.floor(Date.now() / 1000)

const payment = (id: string, amountSats: number): ShownSplash =>
  ({
    transaction: {
      id,
      direction: TxDirection.Receive,
      settlementAmount: amountSats,
      settlementCurrency: WalletCurrency.Btc,
      settlementDisplayAmount: String(amountSats / 1000),
      settlementDisplayCurrency: "USD",
      createdAt: NOW_S,
      memo: null,
    },
    paymentType: "lightning",
    createdAtIsSettlement: true,
    amountSats,
    amountHidden: false,
  }) as ShownSplash

/** Lets the oldest held timing land, as the UI thread would. */
const finishNext = () => {
  const finish = mockFinishers.shift()
  if (!finish) throw new Error("no timing in flight")
  act(() => finish(true))
}

describe("IncomingTransactionSplashOverlay", () => {
  const onClose = jest.fn()
  const onDetails = jest.fn()

  const renderOverlay = (splash: ShownSplash) => {
    const view = render(
      <ContextForScreen>
        <IncomingTransactionSplashOverlay
          splash={splash}
          onClose={onClose}
          onDetails={onDetails}
        />
      </ContextForScreen>,
    )
    const rerender = (next: ShownSplash) =>
      view.rerender(
        <ContextForScreen>
          <IncomingTransactionSplashOverlay
            splash={next}
            onClose={onClose}
            onDetails={onDetails}
          />
        </ContextForScreen>,
      )
    return { rerender }
  }

  /** The iris starts the frame after the amount has been measured. */
  const layOutAmount = async () => {
    const amount = await screen.findByTestId("incoming-transaction-splash-amount", {
      includeHiddenElements: true,
    })
    const nativeMethods = jest.requireActual(
      "@react-native/jest-preset/jest/MockNativeMethods",
    ).default as { measureInWindow: jest.Mock }
    nativeMethods.measureInWindow.mockImplementation(
      (cb: (x: number, y: number, w: number, h: number) => void) => cb(100, 300, 160, 40), // eslint-disable-line max-params
    )
    act(() => fireEvent(amount, "layout", { nativeEvent: { layout: {} } }))
    act(() => jest.advanceTimersByTime(FRAME_MS))
  }

  const haptic = ReactNativeHapticFeedback.trigger as jest.Mock

  beforeAll(() => {
    loadLocale("en")
  })

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockFinishers.length = 0
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {})
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it("lands once, for the newest payment, when two more arrive on its way in", async () => {
    const { rerender } = renderOverlay(payment("a", 1_000))
    await layOutAmount()
    expect(mockFinishers).toHaveLength(1)

    // B and C arrive while A's iris is still closing.
    rerender(payment("b", 2_000))
    rerender(payment("c", 3_000))
    expect(mockFinishers).toHaveLength(1)

    finishNext()
    expect(haptic).toHaveBeenCalledTimes(1)
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/3,000/, { includeHiddenElements: true })).toBeTruthy()

    fireEvent.press(screen.getByText("Close", { includeHiddenElements: true }))
    expect(onClose).not.toHaveBeenCalled()

    act(() => jest.runOnlyPendingTimers())
    fireEvent.press(screen.getByText("Close"))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("keeps the controls off when a payment lands between impact and settle", async () => {
    const { rerender } = renderOverlay(payment("a", 1_000))
    await layOutAmount()
    finishNext()

    rerender(payment("b", 2_000))
    // A's settle would have switched the controls on under B's ring.
    act(() => jest.runOnlyPendingTimers())
    fireEvent.press(screen.getByText("Close", { includeHiddenElements: true }))
    expect(onClose).not.toHaveBeenCalled()

    // C arrives while A still fades out: the ring after it takes C.
    rerender(payment("c", 3_000))
    finishNext()
    expect(mockFinishers).toHaveLength(1)
    finishNext()

    expect(haptic).toHaveBeenCalledTimes(2)
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenLastCalledWith(
      expect.stringContaining("3.00"),
    )
    expect(screen.getByText(/3,000/, { includeHiddenElements: true })).toBeTruthy()

    act(() => jest.runOnlyPendingTimers())
    fireEvent.press(screen.getByText("Details"))
    expect(onDetails).toHaveBeenCalledTimes(1)
  })

  it("keeps the inactive controls out of a screen reader's reach", async () => {
    renderOverlay(payment("a", 1_000))
    await layOutAmount()

    const close = screen.getByText("Close", { includeHiddenElements: true })
    expect(screen.queryByText("Close")).toBeNull()

    finishNext()
    act(() => jest.runOnlyPendingTimers())

    expect(screen.getByText("Close")).toBe(close)
  })

  /** Through the iris and the settle: the controls are alive. */
  const landAndSettle = async () => {
    await layOutAmount()
    finishNext()
    act(() => jest.runOnlyPendingTimers())
  }

  it("keeps Details off while the payment is not yet in the wallet list", async () => {
    const { rerender } = renderOverlay({ ...payment("a", 1_000), detailsPending: true })
    await landAndSettle()

    fireEvent.press(screen.getByText("Details"))
    expect(onDetails).not.toHaveBeenCalled()

    rerender({ ...payment("a", 1_000), detailsPending: false })
    fireEvent.press(screen.getByText("Details"))
    expect(onDetails).toHaveBeenCalledWith({ optedOut: false })
  })

  it("leads with the sats, once, before a price is known", async () => {
    renderOverlay({ ...payment("a", 1_000), unpriced: true })
    await landAndSettle()

    expect(screen.getAllByText("1,000 SAT")).toHaveLength(1)
    expect(screen.queryByText("$1.00")).toBeNull()
  })

  it("holds the iris on Android until the splash window is on screen", async () => {
    jest.replaceProperty(Platform, "OS", "android")
    renderOverlay(payment("a", 1_000))
    await layOutAmount()
    expect(mockFinishers).toHaveLength(0)

    act(() => screen.UNSAFE_getByType(Modal).props.onShow())
    act(() => jest.advanceTimersByTime(FRAME_MS))
    expect(mockFinishers).toHaveLength(1)
  })

  it("reads the payment and each control by name to a screen reader", async () => {
    renderOverlay(payment("a", 1_000))
    await landAndSettle()

    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      "You received $1.00",
    )
    // An accessible root would fold everything under it into one element.
    expect(screen.getByTestId("incoming-transaction-splash").props.accessible).toBe(false)
    expect(screen.getByLabelText("You received $1.00")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Details" })).toBeTruthy()

    const closes = screen.getAllByRole("button", { name: "Close" })
    expect(closes).toHaveLength(2)
    closes.forEach((close) => fireEvent.press(close))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it("shows the fiat amount with the sats under it once priced", async () => {
    renderOverlay(payment("a", 1_000))
    await landAndSettle()

    expect(screen.getByText("$1.00")).toBeTruthy()
    expect(screen.getByText("1,000 SAT")).toBeTruthy()
  })
})
