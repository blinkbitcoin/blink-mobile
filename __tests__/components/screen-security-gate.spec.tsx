import React, { useLayoutEffect } from "react"
import { Text } from "react-native"
import { fireEvent, render } from "@testing-library/react-native"

import { ScreenSecurityGate } from "@app/components/screen-security-gate"
import { ScreenSecurityState } from "@app/hooks/use-screen-security"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { ContextForScreen } from "../screens/helper"

let securityState: ScreenSecurityState = "activating"
jest.mock("@app/hooks/use-screen-security", () => ({
  useScreenSecurity: () => securityState,
}))

const mockSetOptions = jest.fn()
const mockGoBack = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ setOptions: mockSetOptions, goBack: mockGoBack }),
}))

const SENSITIVE = "seed words go here"

const SensitiveContent = () => <Text>{SENSITIVE}</Text>

/** Stands in for the screens' own header effects: a Copy/Paste action installed
 *  from the sensitive subtree must not be installed while the subtree is gated. */
const SensitiveContentWithHeaderAction = () => {
  useLayoutEffect(() => {
    mockSetOptions({ headerRight: () => <Text>Copy</Text> })
  }, [])
  return <Text>{SENSITIVE}</Text>
}

const renderGated = (children: React.ReactNode = <SensitiveContent />) =>
  render(
    <ContextForScreen>
      <ScreenSecurityGate>{children}</ScreenSecurityGate>
    </ContextForScreen>,
  )

describe("ScreenSecurityGate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    securityState = "activating"
  })

  it("renders a neutral placeholder — not the sensitive content — while activating", () => {
    securityState = "activating"

    const { queryByText, queryByTestId } = renderGated()

    expect(queryByText(SENSITIVE)).toBeNull()
    expect(queryByTestId("screen-security-retry")).toBeNull()
  })

  it("mounts the sensitive content once the guard is active", () => {
    securityState = "active"

    const { getByText } = renderGated()

    expect(getByText(SENSITIVE)).toBeTruthy()
  })

  it("keeps the content unmounted after failure and offers retry and back", () => {
    securityState = "failed"

    const { queryByText, getByTestId } = renderGated()

    expect(queryByText(SENSITIVE)).toBeNull()
    expect(getByTestId("screen-security-retry")).toBeTruthy()

    fireEvent.press(getByTestId("screen-security-back"))
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("re-acquires protection when retry is pressed, before showing anything", () => {
    securityState = "failed"
    const { queryByText, getByTestId } = renderGated()

    // The retry remounts the hook subtree; the fresh lease is still registering.
    securityState = "activating"
    fireEvent.press(getByTestId("screen-security-retry"))

    expect(queryByText(SENSITIVE)).toBeNull()
    expect(queryByText("Try Again")).toBeNull()
  })

  it("does not install header actions from the sensitive subtree while gated", () => {
    securityState = "activating"
    const gated = renderGated(<SensitiveContentWithHeaderAction />)

    expect(mockSetOptions).not.toHaveBeenCalled()

    securityState = "active"
    gated.rerender(
      <ContextForScreen>
        <ScreenSecurityGate>
          <SensitiveContentWithHeaderAction />
        </ScreenSecurityGate>
      </ContextForScreen>,
    )

    expect(mockSetOptions).toHaveBeenCalled()
  })
})
