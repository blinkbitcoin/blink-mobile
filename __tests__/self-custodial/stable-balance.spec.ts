import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { deactivateStableBalanceAndRefresh } from "@app/self-custodial/stable-balance"

const mockDeactivateStableBalance = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  ...jest.requireActual("@app/self-custodial/bridge"),
  deactivateStableBalance: (...args: readonly unknown[]) =>
    mockDeactivateStableBalance(...args),
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

const run = () =>
  deactivateStableBalanceAndRefresh({
    sdk: mockSdk,
    refreshWallets: mockRefreshWallets,
    refreshStableBalanceActive: mockRefreshStableBalanceActive,
    LL,
  })

describe("deactivateStableBalanceAndRefresh", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDeactivateStableBalance.mockResolvedValue(undefined)
    mockRefreshWallets.mockResolvedValue(undefined)
    mockRefreshStableBalanceActive.mockResolvedValue(undefined)
  })

  it("deactivates, refreshes and resolves true", async () => {
    await expect(run()).resolves.toBe(true)

    expect(mockDeactivateStableBalance).toHaveBeenCalledWith(mockSdk)
    expect(mockRefreshStableBalanceActive).toHaveBeenCalledTimes(1)
    expect(mockRefreshWallets).toHaveBeenCalledTimes(1)
    expect(mockToastShow).not.toHaveBeenCalled()
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it("toasts and reports a failed deactivation but still refreshes", async () => {
    mockDeactivateStableBalance.mockRejectedValue(new Error("deactivate failed"))

    await expect(run()).resolves.toBe(false)

    expect(mockReportError).toHaveBeenCalledWith(
      "Stable Balance deactivate",
      expect.any(Error),
    )
    expect(mockToastShow).toHaveBeenCalledTimes(1)
    const toastMessage = mockToastShow.mock.calls[0][0].message
    expect(toastMessage(LL)).toBe("Could not update Stable Balance. Please try again.")
    expect(mockRefreshStableBalanceActive).toHaveBeenCalledTimes(1)
    expect(mockRefreshWallets).toHaveBeenCalledTimes(1)
  })

  it("only reports when the refresh fails after a successful deactivation", async () => {
    mockRefreshWallets.mockRejectedValue(new Error("refresh failed"))

    await expect(run()).resolves.toBe(true)

    expect(mockReportError).toHaveBeenCalledWith(
      "Stable Balance refresh",
      expect.any(Error),
    )
    expect(mockToastShow).not.toHaveBeenCalled()
  })
})
