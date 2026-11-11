import React from "react"
import { Alert, AlertButton } from "react-native"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"

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

const lastAlertButtons = (): AlertButton[] => {
  const alertMock = jest.mocked(Alert.alert)
  const call = alertMock.mock.calls[alertMock.mock.calls.length - 1]
  return call?.[2] ?? []
}

const pressInstalledHeaderBack = () => {
  const { headerLeft } = mockSetOptions.mock.calls.at(-1)[0]
  render(
    <ContextForScreen>
      {headerLeft({ canGoBack: true, tintColor: undefined, label: undefined })}
    </ContextForScreen>,
  )
  fireEvent.press(screen.getByLabelText("Go back"))
}

describe("ApiKeySecretReveal", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    beforeRemoveListeners.length = 0
    mockLeaseReady = Promise.resolve()
    jest.spyOn(Alert, "alert").mockImplementation(() => {})
  })

  it("disables the swipe-back gesture", async () => {
    renderReveal()
    await screen.findByTestId("api-key-secret")

    expect(mockSetOptions).toHaveBeenCalledWith(
      expect.objectContaining({ gestureEnabled: false }),
    )
  })

  it("leaves through the header back arrow, the same way as Done", async () => {
    renderReveal()
    await screen.findByTestId("api-key-secret")

    pressInstalledHeaderBack()

    await waitFor(() => expect(mockGoBack).toHaveBeenCalled())
    const event = emitBeforeRemove()
    expect(event.preventDefault).not.toHaveBeenCalled()
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

  it("shows both ends of the key, and copies all of it", async () => {
    const Clipboard = jest.requireMock("@react-native-clipboard/clipboard")
    renderReveal()
    await screen.findByTestId("api-key-secret")

    expect(screen.getByText("blink_S3CR3TS3C...R3TS3CR3T")).toBeTruthy()
    expect(screen.queryByText(API_KEY_SECRET)).toBeNull()

    fireEvent.press(screen.getByTestId("api-key-secret"))

    expect(Clipboard.setString).toHaveBeenCalledWith(API_KEY_SECRET)
  })

  it("announces the key field as a copy button, not the shortened key", async () => {
    renderReveal()
    await screen.findByTestId("api-key-secret")

    const field = screen.getByTestId("api-key-secret")
    expect(field.props.accessibilityRole).toBe("button")
    expect(field.props.accessibilityLabel).toBe(LL.CopySecretComponent.button())
  })

  it("names the key above its one-time warning", async () => {
    renderReveal()
    await screen.findByTestId("api-key-secret")

    expect(screen.getByText("CI bot")).toBeTruthy()
    expect(screen.getByText(LL.ApiScreen.secretWarning())).toBeTruthy()
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

      registration.resolve(undefined)
      await screen.findByTestId("api-key-secret")
      expect(screen.getByText(LL.common.share())).toBeTruthy()
    })

    /** The secret sits in the parent screen's state from the moment it is
     *  created, so the dismissal guard must hold even while the gated content
     *  is not mounted — otherwise a back swipe pops the screen and the
     *  server-once secret is gone without warning. */
    it("blocks dismissal while registration is still pending", async () => {
      const registration = deferred<void>()
      mockLeaseReady = registration.promise

      renderReveal()
      await act(async () => {})

      expect(screen.queryByTestId("api-key-secret")).toBeNull()
      expect(mockSetOptions).toHaveBeenCalledWith(
        expect.objectContaining({ gestureEnabled: false }),
      )
      expect(beforeRemoveListeners.length).toBeGreaterThan(0)
      const event = emitBeforeRemove()
      expect(event.preventDefault).toHaveBeenCalled()
    })

    /** Every removal but Done and the header arrow is blocked, so a registration that
     *  does not land would otherwise leave no way out while it is pending. */
    it("asks before the header arrow discards the secret while registration is pending", async () => {
      const registration = deferred<void>()
      mockLeaseReady = registration.promise

      renderReveal()
      await act(async () => {})
      expect(screen.queryByTestId("api-key-secret")).toBeNull()

      pressInstalledHeaderBack()

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          LL.ApiScreen.discardSecretTitle(),
          LL.ApiScreen.discardSecretBody(),
          expect.any(Array),
        ),
      )
      expect(mockGoBack).not.toHaveBeenCalled()
      const cancel = lastAlertButtons().find((button) => button.style === "cancel")
      cancel?.onPress?.()
      expect(mockGoBack).not.toHaveBeenCalled()

      const discard = lastAlertButtons().find((button) => button.style === "destructive")
      discard?.onPress?.()
      expect(mockGoBack).toHaveBeenCalledTimes(1)
      const event = emitBeforeRemove()
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it("offers Back while registration is pending, and it asks before discarding", async () => {
      const registration = deferred<void>()
      mockLeaseReady = registration.promise

      renderReveal()
      await act(async () => {})
      expect(screen.queryByTestId("api-key-secret")).toBeNull()

      fireEvent.press(screen.getByTestId("screen-security-back"))

      expect(mockGoBack).not.toHaveBeenCalled()
      expect(Alert.alert).toHaveBeenCalledWith(
        LL.ApiScreen.discardSecretTitle(),
        LL.ApiScreen.discardSecretBody(),
        expect.any(Array),
      )
      const discard = lastAlertButtons().find((button) => button.style === "destructive")
      discard?.onPress?.()
      expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it("still blocks dismissal after registration fails", async () => {
      const registration = deferred<void>()
      mockLeaseReady = registration.promise

      renderReveal()
      await act(async () => {})
      registration.reject(new Error("native failure"))
      await screen.findByTestId("screen-security-retry")

      const event = emitBeforeRemove()
      expect(event.preventDefault).toHaveBeenCalled()
    })

    it("asks before the header arrow discards the secret after registration fails", async () => {
      const registration = deferred<void>()
      mockLeaseReady = registration.promise

      renderReveal()
      await act(async () => {})
      registration.reject(new Error("native failure"))
      await screen.findByTestId("screen-security-retry")

      pressInstalledHeaderBack()

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          LL.ApiScreen.discardSecretTitle(),
          LL.ApiScreen.discardSecretBody(),
          expect.any(Array),
        ),
      )
      expect(mockGoBack).not.toHaveBeenCalled()
      const discard = lastAlertButtons().find((button) => button.style === "destructive")
      discard?.onPress?.()
      expect(mockGoBack).toHaveBeenCalledTimes(1)
      const event = emitBeforeRemove()
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it("keeps the secret unmounted after registration fails, and Back asks before discarding it", async () => {
      const registration = deferred<void>()
      mockLeaseReady = registration.promise

      renderReveal()
      await act(async () => {})
      registration.reject(new Error("native failure"))

      await screen.findByTestId("screen-security-retry")
      expect(screen.queryByTestId("api-key-secret")).toBeNull()

      fireEvent.press(screen.getByTestId("screen-security-back"))

      // No silent discard: the user confirms before the unrecoverable secret goes.
      expect(mockGoBack).not.toHaveBeenCalled()
      expect(Alert.alert).toHaveBeenCalledWith(
        LL.ApiScreen.discardSecretTitle(),
        LL.ApiScreen.discardSecretBody(),
        expect.any(Array),
      )

      const discard = lastAlertButtons().find((button) => button.style === "destructive")
      discard?.onPress?.()
      expect(mockGoBack).toHaveBeenCalledTimes(1)
      const event = emitBeforeRemove()
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it("does not leave when the discard confirmation is cancelled", async () => {
      const registration = deferred<void>()
      mockLeaseReady = registration.promise

      renderReveal()
      await act(async () => {})
      registration.reject(new Error("native failure"))
      await screen.findByTestId("screen-security-retry")

      fireEvent.press(screen.getByTestId("screen-security-back"))
      const cancel = lastAlertButtons().find((button) => button.style === "cancel")
      cancel?.onPress?.()

      expect(mockGoBack).not.toHaveBeenCalled()
      const event = emitBeforeRemove()
      expect(event.preventDefault).toHaveBeenCalled()
    })
  })
})
