import React from "react"

import { act, fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { ErrorScreen } from "@app/screens/error-screen/error-screen"

const mockLog = jest.fn()
const mockRecordError = jest.fn()
const mockLogout = jest.fn()
const mockSetAppLocked = jest.fn()
const mockSetAppUnlocked = jest.fn()

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: (...args: string[]) => mockLog(...args),
  recordError: (...args: Error[]) => mockRecordError(...args),
}))

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({ appConfig: { galoyInstance: { name: "Blink" } } }),
}))

jest.mock("@app/hooks/use-logout", () => ({
  __esModule: true,
  default: () => ({ logout: mockLogout }),
}))

jest.mock("@app/navigation/navigation-container-wrapper", () => ({
  useAuthenticationContext: () => ({
    setAppLocked: mockSetAppLocked,
    setAppUnlocked: mockSetAppUnlocked,
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      errors: {
        fatalError: () => "fatal",
        showError: () => "show",
        clearAppData: () => "clear",
      },
      common: { error: () => "error", tryAgain: () => "try again" },
      support: {
        contactUs: () => "contact",
        defaultSupportMessage: () => "support message",
        defaultEmailSubject: () => "subject",
      },
    },
  }),
}))

jest.mock("@app/components/contact-modal/contact-modal", () => ({
  __esModule: true,
  default: () => null,
  SupportChannels: {
    Faq: "faq",
    StatusPage: "statusPage",
    Email: "email",
    Telegram: "telegram",
    Mattermost: "mattermost",
  },
}))

jest.mock("@app/components/screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const renderErrorScreen = (error: Error, resetError: () => void = jest.fn()) =>
  render(
    <ThemeProvider theme={theme}>
      <ErrorScreen error={error} resetError={resetError} />
    </ThemeProvider>,
  )

describe("ErrorScreen crash reporting", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLogout.mockResolvedValue({ isAppLockKept: false })
  })

  it("records the boundary error even when its message looks connectivity-shaped", () => {
    const error = new Error("render timed out waiting for bridge")

    renderErrorScreen(error)

    // alwaysRecord: an ErrorBoundary crash must never be downgraded to a breadcrumb.
    expect(mockRecordError).toHaveBeenCalledWith(error)
  })

  it("records plain defect errors", () => {
    const error = new Error("undefined is not a function")

    renderErrorScreen(error)

    expect(mockRecordError).toHaveBeenCalledWith(error)
  })
})

describe("ErrorScreen app reset", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLogout.mockResolvedValue({ isAppLockKept: false })
  })

  const pressClearAppData = async (resetError: () => void) => {
    const { getByText } = renderErrorScreen(new Error("boom"), resetError)

    await act(async () => {
      fireEvent.press(getByText("clear"))
    })
  }

  /**
   * This boundary sits outside the navigator, so there is no route to reset to: raising
   * the flag is what carries a kept lock across the boundary reset, and without it the
   * user would drop back into the app with the lock it kept never answered.
   */
  it("raises the lock flag before clearing the boundary when the logout kept the lock", async () => {
    mockLogout.mockResolvedValue({ isAppLockKept: true })
    const resetError = jest.fn()

    await pressClearAppData(resetError)

    expect(mockSetAppLocked).toHaveBeenCalledTimes(1)
    expect(resetError).toHaveBeenCalledTimes(1)
    const lockOrder = mockSetAppLocked.mock.invocationCallOrder[0]
    const resetOrder = resetError.mock.invocationCallOrder[0]
    expect(lockOrder).toBeLessThan(resetOrder)
  })

  /** The flag starts raised, so a crash before the first unlock would otherwise leave it
   *  up after the lock itself was erased, with no lock screen left that could lower it. */
  it("lowers the flag when the logout took the lock with it", async () => {
    mockLogout.mockResolvedValue({ isAppLockKept: false })
    const resetError = jest.fn()

    await pressClearAppData(resetError)

    expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
    expect(mockSetAppLocked).not.toHaveBeenCalled()
    expect(resetError).toHaveBeenCalledTimes(1)
  })

  it("raises the flag without lowering it when the lock was kept", async () => {
    mockLogout.mockResolvedValue({ isAppLockKept: true })

    await pressClearAppData(jest.fn())

    expect(mockSetAppUnlocked).not.toHaveBeenCalled()
  })
})
