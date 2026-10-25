import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { ApiKeySecretReveal } from "@app/screens/settings-screen/api/api-key-secret-reveal"

import { ContextForScreen } from "./helper"

const API_KEY_SECRET = "blink_S3CR3TS3CR3TS3CR3TS3CR3TS3CR3TS3CR3T"

type BeforeRemoveEvent = { preventDefault: jest.Mock }
type BeforeRemoveListener = (event: BeforeRemoveEvent) => void

const beforeRemoveListeners: BeforeRemoveListener[] = []
const mockGoBack = jest.fn()
const mockSetOptions = jest.fn()
const mockAddListener = jest.fn((event: string, listener: BeforeRemoveListener) => {
  if (event === "beforeRemove") beforeRemoveListeners.push(listener)
  return jest.fn()
})

jest.mock("@react-navigation/native", () => {
  const actual = jest.requireActual("@react-navigation/native")
  return {
    ...actual,
    useNavigation: () => ({
      goBack: mockGoBack,
      setOptions: mockSetOptions,
      addListener: mockAddListener,
    }),
  }
})

jest.mock("@app/utils/toast", () => ({
  toastShow: jest.fn(),
}))

jest.mock("@react-native-clipboard/clipboard", () => ({
  setString: jest.fn(),
  getString: jest.fn(() => Promise.resolve("")),
}))

jest.mock("@app/utils/screen-security", () => ({
  enableScreenSecurity: jest.fn(() => Promise.resolve()),
  disableScreenSecurity: jest.fn(() => Promise.resolve()),
}))

loadLocale("en")
const LL = i18nObject("en")

const emitBeforeRemove = (): BeforeRemoveEvent => {
  const event = { preventDefault: jest.fn() }
  beforeRemoveListeners.forEach((listener) => listener(event))
  return event
}

const renderReveal = () =>
  render(
    <ContextForScreen>
      <ApiKeySecretReveal secret={API_KEY_SECRET} name="CI bot" />
    </ContextForScreen>,
  )

describe("ApiKeySecretReveal", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    beforeRemoveListeners.length = 0
  })

  it("disables the swipe-back gesture", () => {
    renderReveal()

    expect(mockSetOptions).toHaveBeenCalledWith(
      expect.objectContaining({ gestureEnabled: false }),
    )
  })

  it("leaves through the header back arrow, the same way as Done", async () => {
    renderReveal()

    const { headerLeft } = mockSetOptions.mock.calls.at(-1)[0]
    render(
      <ContextForScreen>
        {headerLeft({ canGoBack: true, tintColor: undefined, label: undefined })}
      </ContextForScreen>,
    )
    fireEvent.press(screen.getByLabelText("Go back"))

    await waitFor(() => expect(mockGoBack).toHaveBeenCalled())
    const event = emitBeforeRemove()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it("blocks hardware and system back navigation", () => {
    renderReveal()

    expect(beforeRemoveListeners.length).toBeGreaterThan(0)
    const event = emitBeforeRemove()
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it("allows leaving via the Done button", () => {
    renderReveal()

    fireEvent.press(screen.getByTestId(LL.ApiScreen.done()))

    expect(mockGoBack).toHaveBeenCalled()
    const event = emitBeforeRemove()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it("shows both ends of the key, and copies all of it", () => {
    const Clipboard = jest.requireMock("@react-native-clipboard/clipboard")
    renderReveal()

    expect(screen.getByText("blink_S3CR3TS3C...R3TS3CR3T")).toBeTruthy()
    expect(screen.queryByText(API_KEY_SECRET)).toBeNull()

    fireEvent.press(screen.getByTestId("api-key-secret"))

    expect(Clipboard.setString).toHaveBeenCalledWith(API_KEY_SECRET)
  })

  it("names the key above its one-time warning", () => {
    renderReveal()

    expect(screen.getByText("CI bot")).toBeTruthy()
    expect(screen.getByText(LL.ApiScreen.secretWarning())).toBeTruthy()
  })
})
