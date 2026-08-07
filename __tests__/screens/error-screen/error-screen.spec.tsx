import React from "react"

import { render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { ErrorScreen } from "@app/screens/error-screen/error-screen"

const mockLog = jest.fn()
const mockRecordError = jest.fn()

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: (...args: string[]) => mockLog(...args),
  recordError: (...args: Error[]) => mockRecordError(...args),
}))

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({ appConfig: { galoyInstance: { name: "Blink" } } }),
}))

jest.mock("@app/hooks/use-logout", () => ({
  __esModule: true,
  default: () => ({ logout: jest.fn() }),
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

const renderErrorScreen = (error: Error) =>
  render(
    <ThemeProvider theme={theme}>
      <ErrorScreen error={error} resetError={jest.fn()} />
    </ThemeProvider>,
  )

describe("ErrorScreen crash reporting", () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
