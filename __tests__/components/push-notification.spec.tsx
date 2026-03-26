import React from "react"
import { render } from "@testing-library/react-native"

import { PushNotificationComponent } from "@app/components/push-notification/push-notification"

const mockRefetchQueries = jest.fn()
jest.mock("@apollo/client", () => ({
  useApolloClient: () => ({
    refetchQueries: mockRefetchQueries,
  }),
}))

jest.mock("@app/graphql/generated", () => ({
  BulletinsDocument: "BulletinsDocument",
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => true,
}))

jest.mock("@app/utils/notifications", () => ({
  hasNotificationPermission: jest.fn(() => Promise.resolve(false)),
  addDeviceToken: jest.fn(),
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
  })

  it("renders without crashing", () => {
    render(<PushNotificationComponent />)
  })

  it("refetches bulletins when foreground message arrives", () => {
    render(<PushNotificationComponent />)

    onMessageCallback({ data: {}, notification: { title: "Test" } })

    expect(mockRefetchQueries).toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.any(Array) }),
    )
  })

  it("unsubscribes on unmount", () => {
    const { unmount } = render(<PushNotificationComponent />)
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })
})
