import React from "react"
import { render, waitFor } from "@testing-library/react-native"

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
const mockUnsubscribe = jest.fn()

jest.mock("@react-native-firebase/messaging", () => {
  const messagingFn = () => ({
    onMessage: (cb: (msg: Record<string, unknown>) => void) => {
      onMessageCallback = cb
      return mockUnsubscribe
    },
    onNotificationOpenedApp: jest.fn(() => mockUnsubscribe),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
    onTokenRefresh: jest.fn(() => jest.fn()),
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

  /** Delivery gates: token registration must depend on auth + permission only —
   *  never on account state such as a lightning address. */
  describe("device token registration", () => {
    it("registers device token when authed with notification permission", async () => {
      mockHasNotificationPermission.mockResolvedValue(true)

      render(<PushNotificationComponent />)

      await waitFor(() => expect(mockAddDeviceToken).toHaveBeenCalledTimes(1))
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
