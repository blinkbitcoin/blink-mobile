import React from "react"
import { render, waitFor } from "@testing-library/react-native"
import { Linking } from "react-native"

import { PushNotificationComponent } from "@app/components/push-notification/push-notification"
import { BulletinsDocument } from "@app/graphql/generated"

import { flushEffects } from "../helpers/flush-effects"

const mockRefetchQueries = jest.fn()
jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useApolloClient: () => ({
    refetchQueries: mockRefetchQueries,
  }),
}))

let mockIsAuthed = true
jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockIsAuthed,
}))

const mockHasNotificationPermission = jest.fn()
const mockAddDeviceToken = jest.fn()
jest.mock("@app/utils/notifications", () => ({
  hasNotificationPermission: () => mockHasNotificationPermission(),
  addDeviceToken: (client: unknown) => mockAddDeviceToken(client),
}))

let onMessageCallback: (msg: Record<string, unknown>) => void
let onNotificationOpenedAppCallback: (msg: Record<string, unknown>) => void
let onTokenRefreshCallback: (() => void) | null = null
let mockInitialNotification: Record<string, unknown> | null = null
const mockUnsubscribe = jest.fn()

jest.mock("@react-native-firebase/messaging", () => {
  const messagingFn = () => ({
    onMessage: (cb: (msg: Record<string, unknown>) => void) => {
      onMessageCallback = cb
      return mockUnsubscribe
    },
    onNotificationOpenedApp: (cb: (msg: Record<string, unknown>) => void) => {
      onNotificationOpenedAppCallback = cb
      return mockUnsubscribe
    },
    getInitialNotification: jest.fn(() => Promise.resolve(mockInitialNotification)),
    onTokenRefresh: (cb: () => void) => {
      onTokenRefreshCallback = cb
      return jest.fn()
    },
  })
  return {
    __esModule: true,
    default: messagingFn,
  }
})

describe("PushNotificationComponent", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAuthed = true
    mockInitialNotification = null
    onTokenRefreshCallback = null
    mockHasNotificationPermission.mockResolvedValue(false)
  })

  it("renders without crashing", () => {
    expect(() => render(<PushNotificationComponent />)).not.toThrow()
  })

  it("refetches bulletins when foreground message arrives", () => {
    render(<PushNotificationComponent />)

    onMessageCallback({ data: {}, notification: { title: "Test" } })

    expect(mockRefetchQueries).toHaveBeenCalledWith({ include: [BulletinsDocument] })
  })

  it("unsubscribes on unmount", () => {
    const { unmount } = render(<PushNotificationComponent />)
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  /** Tap routing goes through the blink: deep link; the receiving-account hint
   *  from the payload must survive as a query param so the transaction-detail
   *  resolver can probe that profile first (#3826). */
  describe("notification tap deep link", () => {
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)

    beforeEach(() => openURLSpy.mockClear())

    it("opens the linkTo path as-is without a recipient hint", () => {
      render(<PushNotificationComponent />)

      onNotificationOpenedAppCallback({ data: { linkTo: "/transaction/tx-1" } })

      expect(openURLSpy).toHaveBeenCalledWith("blink:/transaction/tx-1")
    })

    it("forwards recipientUserId as a query param", () => {
      render(<PushNotificationComponent />)

      onNotificationOpenedAppCallback({
        data: { linkTo: "/transaction/tx-1", recipientUserId: "user-b" },
      })

      expect(openURLSpy).toHaveBeenCalledWith(
        "blink:/transaction/tx-1?recipientUserId=user-b",
      )
    })

    it("does not append the hint to non-transaction links", () => {
      render(<PushNotificationComponent />)

      onNotificationOpenedAppCallback({
        data: { linkTo: "/settings", recipientUserId: "user-b" },
      })

      expect(openURLSpy).toHaveBeenCalledWith("blink:/settings")
    })

    it("leaves a linkTo that already has a query string untouched", () => {
      render(<PushNotificationComponent />)

      onNotificationOpenedAppCallback({
        data: { linkTo: "/transaction/tx-1?foo=bar", recipientUserId: "user-b" },
      })

      expect(openURLSpy).toHaveBeenCalledWith("blink:/transaction/tx-1?foo=bar")
    })

    it("ignores notifications without a data payload", () => {
      render(<PushNotificationComponent />)

      onNotificationOpenedAppCallback({})

      expect(openURLSpy).not.toHaveBeenCalled()
    })

    it("ignores links that do not start with a slash", () => {
      render(<PushNotificationComponent />)

      onNotificationOpenedAppCallback({
        data: { linkTo: "https://evil.example/transaction/tx-1" },
      })

      expect(openURLSpy).not.toHaveBeenCalled()
    })

    it("logs instead of throwing when opening the link fails", () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => undefined)
      openURLSpy.mockImplementationOnce(() => {
        throw new Error("no handler for scheme")
      })
      render(<PushNotificationComponent />)

      expect(() =>
        onNotificationOpenedAppCallback({ data: { linkTo: "/transaction/tx-1" } }),
      ).not.toThrow()

      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })

    it("follows the initial notification on cold start, hint included", async () => {
      mockInitialNotification = {
        data: { linkTo: "/transaction/tx-1", recipientUserId: "user-b" },
      }

      render(<PushNotificationComponent />)

      await waitFor(() =>
        expect(openURLSpy).toHaveBeenCalledWith(
          "blink:/transaction/tx-1?recipientUserId=user-b",
        ),
      )
    })
  })

  /** Delivery gates: token registration must depend on auth + permission only —
   *  never on account state such as a lightning address. */
  describe("device token registration", () => {
    it("registers device token when authed with notification permission", async () => {
      mockHasNotificationPermission.mockResolvedValue(true)

      render(<PushNotificationComponent />)

      await waitFor(() => expect(mockAddDeviceToken).toHaveBeenCalledTimes(1))
    })

    it("re-registers the device token when it refreshes", async () => {
      mockHasNotificationPermission.mockResolvedValue(true)

      render(<PushNotificationComponent />)

      await waitFor(() => expect(mockAddDeviceToken).toHaveBeenCalledTimes(1))
      expect(onTokenRefreshCallback).not.toBeNull()

      onTokenRefreshCallback?.()

      expect(mockAddDeviceToken).toHaveBeenCalledTimes(2)
    })

    it("does not register device token when not authed", async () => {
      mockIsAuthed = false
      mockHasNotificationPermission.mockResolvedValue(true)

      render(<PushNotificationComponent />)
      await flushEffects()

      expect(mockHasNotificationPermission).not.toHaveBeenCalled()
      expect(mockAddDeviceToken).not.toHaveBeenCalled()
    })

    it("does not register device token without notification permission", async () => {
      render(<PushNotificationComponent />)
      await flushEffects()

      expect(mockHasNotificationPermission).toHaveBeenCalledTimes(1)
      expect(mockAddDeviceToken).not.toHaveBeenCalled()
    })
  })
})
