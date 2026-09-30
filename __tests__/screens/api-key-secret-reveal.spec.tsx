import React from "react"
import { Alert, Share } from "react-native"

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"

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

jest.mock("@app/utils/screen-security", () => ({
  enableScreenSecurity: jest.fn(),
  disableScreenSecurity: jest.fn(),
}))

const mockRecordAppError = jest.fn()
jest.mock("@app/utils/error-reporting", () => ({
  ...jest.requireActual("@app/utils/error-reporting"),
  recordAppError: (...args: unknown[]) => mockRecordAppError(...args),
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

  it("hides the header back button and disables the swipe-back gesture", () => {
    renderReveal()

    expect(mockSetOptions).toHaveBeenCalledWith(
      expect.objectContaining({ headerBackVisible: false, gestureEnabled: false }),
    )
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

  describe("sharing the secret", () => {
    let share: jest.SpyInstance

    /** The screen's other async work reports through the same sink; only the share's own
     *  reports are this suite's business. */
    const shareReports = () =>
      mockRecordAppError.mock.calls.filter(
        ([, options]) =>
          (options as { dedupKey?: string })?.dedupKey === "api-key-secret-share",
      )

    beforeEach(() => {
      share = jest
        .spyOn(Share, "share")
        .mockResolvedValue({ action: "sharedAction" } as never)
    })

    afterEach(() => {
      share.mockRestore()
    })

    it("hands the secret to the share sheet", async () => {
      renderReveal()

      fireEvent.press(screen.getByLabelText(LL.common.share()))

      await waitFor(() => expect(share).toHaveBeenCalledWith({ message: API_KEY_SECRET }))
      expect(shareReports()).toHaveLength(0)
    })

    it("reports a failed share through the app's one sink, and tells the user", async () => {
      // The report goes through recordAppError rather than the crash SDK directly, so it
      // obeys the same rule as everything else: nothing from a device that may not report.
      share.mockRejectedValue(new Error("share sheet unavailable"))
      const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined)
      renderReveal()

      fireEvent.press(screen.getByLabelText(LL.common.share()))

      await waitFor(() =>
        expect(mockRecordAppError).toHaveBeenCalledWith(
          expect.objectContaining({ message: "share sheet unavailable" }),
          { dedupKey: "api-key-secret-share" },
        ),
      )
      expect(alert).toHaveBeenCalledWith("share sheet unavailable")
      alert.mockRestore()
    })

    it("says nothing when the share sheet rejects with something that is not an error", async () => {
      share.mockRejectedValue("dismissed")
      renderReveal()

      fireEvent.press(screen.getByLabelText(LL.common.share()))

      await waitFor(() => expect(share).toHaveBeenCalled())
      expect(shareReports()).toHaveLength(0)
    })
  })
})
