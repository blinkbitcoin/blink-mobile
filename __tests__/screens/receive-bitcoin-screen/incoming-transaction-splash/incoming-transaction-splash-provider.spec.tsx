import React from "react"
import { AppState, Keyboard } from "react-native"
import { act, render } from "@testing-library/react-native"
import { it } from "@jest/globals"

import { TxDirection, WalletCurrency } from "@app/graphql/generated"
import { useIncomingTransactionSplash } from "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/incoming-transaction-splash-context"
import { IncomingTransactionSplashProvider } from "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/incoming-transaction-splash-provider"
import { SplashCandidate } from "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/types"

const mockNavigate = jest.fn()
jest.mock("@app/navigation/navigation-container-wrapper", () => ({
  navigationRef: {
    isReady: () => true,
    getCurrentRoute: () => ({ name: "Home" }),
    navigate: (...args: unknown[]) => mockNavigate(...args),
  },
  useAuthenticationContext: () => ({ isAppLocked: false }),
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

const renderProvider = () => {
  const context: { current: ReturnType<typeof useIncomingTransactionSplash> | null } = {
    current: null,
  }
  const Probe = () => {
    context.current = useIncomingTransactionSplash()
    return null
  }
  render(
    <IncomingTransactionSplashProvider>
      <Probe />
    </IncomingTransactionSplashProvider>,
  )
  if (!context.current) throw new Error("context not mounted")
  return context.current
}

describe("IncomingTransactionSplashProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockOverlay = null
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
})
