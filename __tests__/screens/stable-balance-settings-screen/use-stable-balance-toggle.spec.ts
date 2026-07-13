import { act, renderHook } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { useStableBalanceToggle } from "@app/screens/stable-balance-settings-screen/hooks/use-stable-balance-toggle"

const mockActivateStableBalance = jest.fn()
const mockDeactivateStableBalance = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  ...jest.requireActual("@app/self-custodial/bridge"),
  activateStableBalance: (...args: readonly unknown[]) =>
    mockActivateStableBalance(...args),
  deactivateStableBalance: (...args: readonly unknown[]) =>
    mockDeactivateStableBalance(...args),
}))

let mockIsDollarBalanceRestricted = false

jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceRestricted: () => mockIsDollarBalanceRestricted,
}))

const mockLogActivated = jest.fn()

jest.mock("@app/self-custodial/analytics", () => ({
  logSelfCustodialStableBalanceActivated: (...args: readonly unknown[]) =>
    mockLogActivated(...args),
}))

const mockReportError = jest.fn()

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
}))

const mockToastShow = jest.fn()

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

loadLocale("en")
const LL = i18nObject("en")

const mockSdk = { id: "sdk" } as never
const mockRefreshWallets = jest.fn()
const mockRefreshStableBalanceActive = jest.fn()

const renderToggle = (overrides?: {
  isStableBalanceActive?: boolean
  sdk?: typeof mockSdk | null
}) =>
  renderHook(() =>
    useStableBalanceToggle({
      sdk: overrides?.sdk === undefined ? mockSdk : overrides.sdk,
      isStableBalanceActive: overrides?.isStableBalanceActive ?? false,
      refreshWallets: mockRefreshWallets,
      refreshStableBalanceActive: mockRefreshStableBalanceActive,
      LL,
    }),
  )

describe("useStableBalanceToggle", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsDollarBalanceRestricted = false
    mockActivateStableBalance.mockResolvedValue(undefined)
    mockDeactivateStableBalance.mockResolvedValue(undefined)
    mockRefreshWallets.mockResolvedValue(undefined)
    mockRefreshStableBalanceActive.mockResolvedValue(undefined)
  })

  it("activates the stable balance and refreshes the wallet state", async () => {
    const { result } = renderToggle()

    await act(async () => {
      await result.current.apply(true)
    })

    expect(mockActivateStableBalance).toHaveBeenCalledTimes(1)
    expect(mockLogActivated).toHaveBeenCalledTimes(1)
    expect(mockRefreshStableBalanceActive).toHaveBeenCalledTimes(1)
    expect(mockRefreshWallets).toHaveBeenCalledTimes(1)
  })

  it("deactivates the stable balance without the activation analytics", async () => {
    const { result } = renderToggle({ isStableBalanceActive: true })

    await act(async () => {
      await result.current.apply(false)
    })

    expect(mockDeactivateStableBalance).toHaveBeenCalledTimes(1)
    expect(mockLogActivated).not.toHaveBeenCalled()
  })

  it("blocks the activation for restricted regions with a toast and snaps the switch back", async () => {
    mockIsDollarBalanceRestricted = true
    const { result } = renderToggle()
    const initialSwitchKey = result.current.switchKey

    await act(async () => {
      await result.current.apply(true)
    })

    expect(mockActivateStableBalance).not.toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalledTimes(1)
    const blockedMessage = mockToastShow.mock.calls[0][0].message
    expect(blockedMessage(LL)).toBe("Dollar Balance is not available in your region")
    expect(result.current.switchKey).toBe(initialSwitchKey + 1)
    expect(mockRefreshWallets).not.toHaveBeenCalled()
  })

  it("still allows deactivating while restricted, so an active balance can be freed", async () => {
    mockIsDollarBalanceRestricted = true
    const { result } = renderToggle({ isStableBalanceActive: true })

    await act(async () => {
      await result.current.apply(false)
    })

    expect(mockDeactivateStableBalance).toHaveBeenCalledTimes(1)
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("does nothing without a connected SDK", async () => {
    const { result } = renderToggle({ sdk: null })

    await act(async () => {
      await result.current.apply(true)
    })

    expect(mockActivateStableBalance).not.toHaveBeenCalled()
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("reports and resyncs the switch when the toggle fails", async () => {
    mockActivateStableBalance.mockRejectedValue(new Error("toggle failed"))
    const { result } = renderToggle()
    const initialSwitchKey = result.current.switchKey

    await act(async () => {
      await result.current.apply(true)
    })

    expect(mockReportError).toHaveBeenCalledWith(
      "Stable Balance toggle",
      expect.any(Error),
    )
    expect(mockToastShow).toHaveBeenCalledTimes(1)
    const failureMessage = mockToastShow.mock.calls[0][0].message
    expect(failureMessage(LL)).toBe("Could not update Stable Balance. Please try again.")
    expect(result.current.switchKey).toBe(initialSwitchKey + 1)
  })
})
