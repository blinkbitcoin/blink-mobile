import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { it } from "@jest/globals"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { SplashToggleRow } from "@app/screens/settings-screen/notifications-screen"

import { ContextForScreen } from "../helper"

let mockEnabled = true
const mockSetEnabled = jest.fn()
const mockToast = jest.fn()
jest.mock(
  "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/use-splash-settings",
  () => ({
    useSplashSettings: () => ({
      enabled: mockEnabled,
      minSats: 100,
      setEnabled: mockSetEnabled,
      setMinSats: jest.fn(),
    }),
    toastSplashSetting: (...args: unknown[]) => mockToast(...args),
  }),
)

/** The atomic switch animates through reanimated; only its press matters here. */
jest.mock("@app/components/atomic/switch", () => {
  const { Pressable } = jest.requireActual("react-native")
  return {
    Switch: ({
      value,
      onValueChange,
    }: {
      value: boolean
      onValueChange: (value: boolean) => void
    }) => <Pressable accessibilityRole="switch" onPress={() => onValueChange(!value)} />,
  }
})

const mockOptedOut = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  ...jest.requireActual("@app/utils/analytics"),
  logIncomingTransactionSplashOptedOut: (...args: unknown[]) => mockOptedOut(...args),
}))

const renderRow = () =>
  render(
    <ContextForScreen>
      <SplashToggleRow />
    </ContextForScreen>,
  )

describe("SplashToggleRow", () => {
  beforeAll(() => {
    loadLocale("en")
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockEnabled = true
  })

  it("turns the splash off, confirms it with a toast and reports the opt-out", async () => {
    renderRow()

    fireEvent.press(await screen.findByRole("switch"))

    expect(mockSetEnabled).toHaveBeenCalledWith(false)
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
    expect(mockOptedOut).toHaveBeenCalledTimes(1)
    expect(mockOptedOut).toHaveBeenCalledWith({ source: "settings" })
  })

  it("turns the splash on with a toast and reports nothing", async () => {
    mockEnabled = false
    renderRow()

    fireEvent.press(await screen.findByRole("switch"))

    expect(mockSetEnabled).toHaveBeenCalledWith(true)
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }))
    expect(mockOptedOut).not.toHaveBeenCalled()
  })
})
