import React from "react"
import { AppState, AppStateStatus, Keyboard } from "react-native"
import { act, render } from "@testing-library/react-native"
import { it } from "@jest/globals"

import { TxDirection, WalletCurrency } from "@app/graphql/generated"
import { useIncomingTransactionSplash } from "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/incoming-transaction-splash-context"
import { IncomingTransactionSplashProvider } from "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/incoming-transaction-splash-provider"
import { SplashCandidate } from "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/types"

const mockNavigate = jest.fn()
let mockAppLocked = false
jest.mock("@app/navigation/navigation-container-wrapper", () => ({
  navigationRef: {
    isReady: () => true,
    getCurrentRoute: () => ({ name: "Home" }),
    navigate: (...args: unknown[]) => mockNavigate(...args),
  },
  useAuthenticationContext: () => ({ isAppLocked: mockAppLocked }),
}))

jest.mock("@app/graphql/hide-amount-context", () => ({
  useHideAmount: () => ({ hideAmount: false }),
}))
jest.mock("@app/hooks/use-hide-balance-setting", () => ({
  useHideBalanceSetting: () => ({ alwaysHideBalance: false }),
}))
jest.mock("@app/i18n/i18n-react", () => ({ useI18nContext: () => ({ LL: {} }) }))
jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => ({ convertMoneyAmount: undefined }),
}))

const mockOptedOut = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logIncomingTransactionSplashOptedOut: (...args: unknown[]) => mockOptedOut(...args),
}))

const mockSetEnabled = jest.fn()
jest.mock(
  "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/use-splash-settings",
  () => ({
    useSplashSettings: () => ({
      enabled: true,
      minSats: 100,
      setEnabled: mockSetEnabled,
    }),
    toastSplashSetting: jest.fn(),
  }),
)

type OverlayProps = {
  splash: SplashCandidate & { detailsPending?: boolean }
  onClose: (action: { optedOut: boolean }) => void
  onDetails: (action: { optedOut: boolean }) => void
}
let mockOverlay: OverlayProps | null = null
jest.mock(
  "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/incoming-transaction-splash-overlay",
  () => ({
    IncomingTransactionSplashOverlay: (props: OverlayProps) => {
      mockOverlay = props
      return null
    },
  }),
)

const NOW_S = Math.floor(Date.now() / 1000)

const candidate = (overrides: Partial<SplashCandidate> = {}): SplashCandidate =>
  ({
    transaction: {
      id: "tx-1",
      direction: TxDirection.Receive,
      settlementAmount: 5_000,
      settlementCurrency: WalletCurrency.Btc,
      settlementDisplayAmount: "5000",
      settlementDisplayCurrency: "USD",
      createdAt: NOW_S,
      memo: null,
    },
    paymentType: "lightning",
    createdAtIsSettlement: true,
    ...overrides,
  }) as SplashCandidate

/** The provider's AppState listener, captured as it subscribes. */
const captureAppState = () => {
  const ref: { current: ((state: AppStateStatus) => void) | null } = { current: null }
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
    ref.current = handler as (state: AppStateStatus) => void
    return { remove: jest.fn() } as never
  })
  return ref
}

const renderProvider = () => {
  const context: { current: ReturnType<typeof useIncomingTransactionSplash> | null } = {
    current: null,
  }
  const Probe = () => {
    context.current = useIncomingTransactionSplash()
    return null
  }
  const tree = () => (
    <IncomingTransactionSplashProvider>
      <Probe />
    </IncomingTransactionSplashProvider>
  )
  const { rerender } = render(tree())
  if (!context.current) throw new Error("context not mounted")
  return Object.assign(context.current, { rerender: () => rerender(tree()) })
}

describe("IncomingTransactionSplashProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
    mockOverlay = null
    mockAppLocked = false
    Object.defineProperty(AppState, "currentState", {
      value: "active",
      configurable: true,
    })
    jest.spyOn(Keyboard, "isVisible").mockReturnValue(false)
  })

  it("keeps Details inactive until the wallet list holds the payment", () => {
    const splash = renderProvider()

    act(() => {
      expect(splash.showSplash(candidate({ detailsPending: true }))).toBe(true)
    })
    act(() => mockOverlay?.onDetails({ optedOut: false }))

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockOverlay?.splash.detailsPending).toBe(true)

    act(() => splash.refresh(candidate()))
    act(() => mockOverlay?.onDetails({ optedOut: false }))

    expect(mockNavigate).toHaveBeenCalledWith("transactionDetail", { txid: "tx-1" })
  })

  it("reports an opt-out once and turns the splash off", () => {
    const splash = renderProvider()

    act(() => {
      splash.showSplash(candidate())
    })
    act(() => mockOverlay?.onClose({ optedOut: true }))

    expect(mockSetEnabled).toHaveBeenCalledWith(false)
    expect(mockOptedOut).toHaveBeenCalledTimes(1)
    expect(mockOptedOut).toHaveBeenCalledWith({ source: "splash" })
  })

  it("reports nothing on a plain close", () => {
    const splash = renderProvider()

    act(() => {
      splash.showSplash(candidate())
    })
    act(() => mockOverlay?.onClose({ optedOut: false }))

    expect(mockOptedOut).not.toHaveBeenCalled()
    expect(mockSetEnabled).not.toHaveBeenCalled()
  })

  it("says whether the splash went on screen", () => {
    const splash = renderProvider()
    const aYearAgo = NOW_S - 365 * 24 * 60 * 60

    act(() => {
      expect(
        splash.showSplash(
          candidate({
            transaction: { ...candidate().transaction, id: "old", createdAt: aYearAgo },
          }),
        ),
      ).toBe(false)
      expect(splash.showSplash(candidate())).toBe(true)
      expect(splash.showSplash(candidate())).toBe(false)
    })
  })

  it("shows every deposit from one event in turn, the next on Close", () => {
    const splash = renderProvider()
    const deposit = (id: string) =>
      candidate({ transaction: { ...candidate().transaction, id } })

    act(() => splash.showSplashes([deposit("a:0"), deposit("b:1")]))
    expect(mockOverlay?.splash.transaction.id).toBe("a:0")

    act(() => mockOverlay?.onClose({ optedOut: false }))
    expect(mockOverlay?.splash.transaction.id).toBe("b:1")
  })

  it("puts a batch that lands while a splash is up in line behind it, in order", () => {
    const splash = renderProvider()
    const deposit = (id: string) =>
      candidate({ transaction: { ...candidate().transaction, id } })

    act(() => splash.showSplashes([deposit("a:0"), deposit("b:1")]))
    act(() => splash.showSplashes([deposit("c:0"), deposit("d:1")]))

    const closeAndRead = () => {
      act(() => mockOverlay?.onClose({ optedOut: false }))
      return mockOverlay?.splash.transaction.id
    }
    expect(mockOverlay?.splash.transaction.id).toBe("a:0")
    expect([closeAndRead(), closeAndRead(), closeAndRead()]).toEqual([
      "b:1",
      "c:0",
      "d:1",
    ])
  })

  it("puts a second batch in line even before the first one renders", () => {
    const splash = renderProvider()
    const deposit = (id: string) =>
      candidate({ transaction: { ...candidate().transaction, id } })

    act(() => {
      splash.showSplashes([deposit("a:0")])
      splash.showSplashes([deposit("b:1")])
    })
    expect(mockOverlay?.splash.transaction.id).toBe("a:0")

    act(() => mockOverlay?.onClose({ optedOut: false }))
    expect(mockOverlay?.splash.transaction.id).toBe("b:1")
  })

  it("drops the rest of a batch on opt-out", () => {
    const splash = renderProvider()
    const deposit = (id: string) =>
      candidate({ transaction: { ...candidate().transaction, id } })

    act(() => splash.showSplashes([deposit("a:0"), deposit("b:1")]))
    act(() => mockOverlay?.onClose({ optedOut: true }))
    mockOverlay = null
    act(() => splash.refresh(deposit("b:1")))

    expect(mockOverlay).toBeNull()
  })

  describe("lifecycle", () => {
    it("dismisses the splash and its queue when the app goes to the background", () => {
      const appState = captureAppState()
      const splash = renderProvider()
      const deposit = (id: string) =>
        candidate({ transaction: { ...candidate().transaction, id } })

      act(() => splash.showSplashes([deposit("a:0"), deposit("b:1")]))
      mockOverlay = null
      act(() => appState.current?.("inactive"))
      act(() => splash.refresh(deposit("a:0")))
      expect(mockOverlay).not.toBeNull()

      act(() => appState.current?.("background"))
      mockOverlay = null
      act(() => splash.refresh(deposit("a:0")))
      expect(mockOverlay).toBeNull()

      act(() => {
        expect(splash.showSplash(deposit("c:0"))).toBe(true)
      })
      act(() => mockOverlay?.onClose({ optedOut: false }))
      mockOverlay = null
      act(() => splash.refresh(deposit("b:1")))

      expect(mockOverlay).toBeNull()
    })

    it("dismisses the splash when the app locks", () => {
      const splash = renderProvider()

      act(() => {
        splash.showSplash(candidate())
      })
      mockAppLocked = true
      act(() => splash.rerender())
      mockOverlay = null
      act(() => splash.refresh(candidate()))

      expect(mockOverlay).toBeNull()
    })

    /** A payment made while the app was away settled before it came back. */
    it("measures freshness from the latest return to the foreground", () => {
      jest.useFakeTimers({ now: Date.now() })
      const appState = captureAppState()
      const splash = renderProvider()
      const createdAt = Math.floor(Date.now() / 1000) + 30 * 60
      const away = candidate({
        transaction: { ...candidate().transaction, id: "away", createdAt },
      })

      jest.advanceTimersByTime(60 * 60 * 1000)
      act(() => appState.current?.("active"))

      act(() => {
        expect(splash.showSplash(away)).toBe(false)
      })
      jest.useRealTimers()
    })

    /** A restore replays the payment completed; the same id can still land live later. */
    it("does not remember a replayed payment, so its live event still shows", () => {
      const splash = renderProvider()
      const twoHoursAgo = NOW_S - 2 * 60 * 60
      const replayed = candidate({
        transaction: { ...candidate().transaction, id: "p1", createdAt: twoHoursAgo },
      })

      act(() => {
        expect(splash.showSplash(replayed)).toBe(false)
        expect(splash.showSplash({ ...replayed, claimSeenLive: true })).toBe(true)
      })
    })
  })

  describe("Details", () => {
    it("opens the unclaimed deposits screen for a deposit", () => {
      const splash = renderProvider()

      act(() => {
        splash.showSplash(candidate({ paymentType: "onchain", unclaimedDeposit: true }))
      })
      act(() => mockOverlay?.onDetails({ optedOut: false }))

      expect(mockNavigate).toHaveBeenCalledWith("unclaimedDepositsScreen")
    })

    it("opens the transaction for any other payment", () => {
      const splash = renderProvider()

      act(() => {
        splash.showSplash(candidate())
      })
      act(() => mockOverlay?.onDetails({ optedOut: false }))

      expect(mockNavigate).toHaveBeenCalledWith("transactionDetail", { txid: "tx-1" })
    })

    /** Ruled by product: Details leaves the splash, and the line behind it goes too,
     *  whatever the splash on screen is. */
    it("drops the splashes queued behind it, whatever the splash on screen is", () => {
      const splash = renderProvider()
      const deposit = (id: string) =>
        candidate({ transaction: { ...candidate().transaction, id } })

      act(() => splash.showSplashes([deposit("a:0"), deposit("b:1")]))
      act(() => mockOverlay?.onDetails({ optedOut: false }))
      mockOverlay = null
      act(() => splash.refresh(deposit("b:1")))

      expect(mockOverlay).toBeNull()
    })
  })
})
