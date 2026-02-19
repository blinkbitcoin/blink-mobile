import { renderHook } from "@testing-library/react-hooks"

import { useNotificationPermission } from "@app/hooks/use-notification-permission"

const mockRequestNotificationPermission = jest.fn()
const mockAddDeviceToken = jest.fn()
jest.mock("@app/utils/notifications", () => ({
  requestNotificationPermission: () => mockRequestNotificationPermission(),
  addDeviceToken: (...args: ReadonlyArray<Record<string, unknown>>) =>
    mockAddDeviceToken(...args),
}))

const mockUseIsAuthed = jest.fn()
jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

const mockUseIsFocused = jest.fn()
jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => mockUseIsFocused(),
}))

const mockClient = { link: "mock-client" }
jest.mock("@apollo/client", () => ({
  useApolloClient: () => mockClient,
}))

jest.mock("@react-native-firebase/messaging", () => ({
  __esModule: true,
  default: {
    AuthorizationStatus: {
      AUTHORIZED: 1,
      PROVISIONAL: 3,
      DENIED: 0,
      NOT_DETERMINED: -1,
    },
  },
}))

describe("useNotificationPermission", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockUseIsAuthed.mockReturnValue(true)
    mockUseIsFocused.mockReturnValue(true)
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it("does not prompt when not authed", () => {
    mockUseIsAuthed.mockReturnValue(false)

    renderHook(() => useNotificationPermission())

    jest.advanceTimersByTime(6000)

    expect(mockRequestNotificationPermission).not.toHaveBeenCalled()
  })

  it("does not prompt when not focused", () => {
    mockUseIsFocused.mockReturnValue(false)

    renderHook(() => useNotificationPermission())

    jest.advanceTimersByTime(6000)

    expect(mockRequestNotificationPermission).not.toHaveBeenCalled()
  })

  it("requests permission after 5 second delay when authed and focused", async () => {
    mockRequestNotificationPermission.mockResolvedValue(1)
    mockAddDeviceToken.mockResolvedValue(undefined)

    renderHook(() => useNotificationPermission())

    expect(mockRequestNotificationPermission).not.toHaveBeenCalled()

    jest.advanceTimersByTime(5000)

    await Promise.resolve()

    expect(mockRequestNotificationPermission).toHaveBeenCalledTimes(1)
  })

  it("adds device token when permission is authorized", async () => {
    mockRequestNotificationPermission.mockResolvedValue(1)
    mockAddDeviceToken.mockResolvedValue(undefined)

    renderHook(() => useNotificationPermission())

    jest.advanceTimersByTime(5000)

    await Promise.resolve()
    await Promise.resolve()

    expect(mockAddDeviceToken).toHaveBeenCalledWith(mockClient)
  })

  it("adds device token when permission is provisional", async () => {
    mockRequestNotificationPermission.mockResolvedValue(3)
    mockAddDeviceToken.mockResolvedValue(undefined)

    renderHook(() => useNotificationPermission())

    jest.advanceTimersByTime(5000)

    await Promise.resolve()
    await Promise.resolve()

    expect(mockAddDeviceToken).toHaveBeenCalledWith(mockClient)
  })

  it("does not add device token when permission is denied", async () => {
    mockRequestNotificationPermission.mockResolvedValue(0)

    renderHook(() => useNotificationPermission())

    jest.advanceTimersByTime(5000)

    await Promise.resolve()
    await Promise.resolve()

    expect(mockAddDeviceToken).not.toHaveBeenCalled()
  })

  it("clears timeout on unmount", () => {
    const { unmount } = renderHook(() => useNotificationPermission())

    unmount()

    jest.advanceTimersByTime(6000)

    expect(mockRequestNotificationPermission).not.toHaveBeenCalled()
  })
})
