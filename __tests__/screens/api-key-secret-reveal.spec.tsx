import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { ApiKeySecretReveal } from "@app/screens/settings-screen/api/api-key-secret-reveal"

import { ContextForScreen } from "./helper"

const API_KEY_SECRET = "blink_S3CR3TS3CR3TS3CR3T"

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

const mockReleaseScreenSecurity = jest.fn(() => Promise.resolve())
let mockLeaseReady: Promise<void> = Promise.resolve()
jest.mock("@app/utils/screen-security", () => ({
  acquireScreenSecurity: () => ({
    ready: mockLeaseReady,
    release: mockReleaseScreenSecurity,
  }),
}))

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {}
  let reject: (reason: Error) => void = () => {}
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

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
    mockLeaseReady = Promise.resolve()
  })

  it("hides the header back button and disables the swipe-back gesture", async () => {
    renderReveal()
    await screen.findByTestId("api-key-secret")

    expect(mockSetOptions).toHaveBeenCalledWith(
      expect.objectContaining({ headerBackVisible: false, gestureEnabled: false }),
    )
  })

  it("blocks hardware and system back navigation", async () => {
    renderReveal()
    await screen.findByTestId("api-key-secret")

    expect(beforeRemoveListeners.length).toBeGreaterThan(0)
    const event = emitBeforeRemove()
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it("allows leaving via the Done button", async () => {
    renderReveal()
    await screen.findByTestId("api-key-secret")

    fireEvent.press(screen.getByTestId(LL.ApiScreen.done()))

    expect(mockGoBack).toHaveBeenCalled()
    const event = emitBeforeRemove()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  /** The reveal shows a one-time API secret: until the screen guard is actually
   *  on, none of the secret, its QR, or the Copy/Share actions may exist. */
  describe("screen security gate", () => {
    it("shows nothing sensitive while registration is pending, and the secret once it resolves", async () => {
      const registration = deferred<void>()
      mockLeaseReady = registration.promise

      renderReveal()
      await act(async () => {})

      expect(screen.queryByTestId("api-key-secret")).toBeNull()
      expect(screen.queryByText(LL.common.share())).toBeNull()
      expect(mockSetOptions).not.toHaveBeenCalled()

      registration.resolve(undefined)
      await screen.findByTestId("api-key-secret")
      expect(screen.getByText(LL.common.share())).toBeTruthy()
    })

    it("keeps the secret unmounted after registration fails, and Back still leaves", async () => {
      const registration = deferred<void>()
      mockLeaseReady = registration.promise

      renderReveal()
      await act(async () => {})
      registration.reject(new Error("native failure"))

      await screen.findByTestId("screen-security-retry")
      expect(screen.queryByTestId("api-key-secret")).toBeNull()
      expect(mockSetOptions).not.toHaveBeenCalled()

      fireEvent.press(screen.getByTestId("screen-security-back"))
      expect(mockGoBack).toHaveBeenCalledTimes(1)
    })
  })
})
