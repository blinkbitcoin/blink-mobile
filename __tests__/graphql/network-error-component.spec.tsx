import React from "react"
import { render, waitFor } from "@testing-library/react-native"
import { Alert } from "react-native"

import { useI18nContext } from "@app/i18n/i18n-react"
import useLogout from "@app/hooks/use-logout"
import { useAppConfig } from "@app/hooks"
import { toastShow } from "@app/utils/toast"
import { useNavigation } from "@react-navigation/native"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { useNetworkError } from "@app/graphql/network-error-context"
import { NetworkErrorCode } from "@app/graphql/error-code"
import { NetworkErrorComponent } from "@app/graphql/network-error-component"

type TestNetworkError =
  | null
  | { statusCode: number; result?: { errors?: { code?: NetworkErrorCode }[] } }
  | { message: string }

jest.mock("@app/graphql/network-error-context")
jest.mock("@app/i18n/i18n-react")
jest.mock("@app/hooks/use-logout")
jest.mock("@app/hooks")
jest.mock("@app/utils/toast")
jest.mock("@react-navigation/native")
jest.mock("@app/utils/storage/secureStorage")

const mockClearNetworkError = jest.fn()
const mockToastShow = toastShow as jest.Mock
const mockLogout = jest.fn()
const mockSaveToken = jest.fn()
const mockNavigate = jest.fn()
const mockReset = jest.fn()

const mockNavigation = {
  navigate: mockNavigate,
  reset: mockReset,
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(useNetworkError as jest.Mock).mockReturnValue({
    networkError: null,
    clearNetworkError: mockClearNetworkError,
  })
  ;(useI18nContext as jest.Mock).mockReturnValue({
    LL: {
      common: { reauth: () => "Please re-authenticate", ok: () => "OK" },
      ProfileScreen: { switchAccount: () => "Switched account" },
      errors: {
        network: {
          server: () => "Server error",
          request: () => "Request failed",
          connection: () => "No connection",
        },
      },
    },
  })
  ;(useLogout as jest.Mock).mockReturnValue({ logout: mockLogout })
  ;(useAppConfig as jest.Mock).mockReturnValue({
    appConfig: { token: "current-token" },
    saveToken: mockSaveToken,
  })
  ;(useNavigation as jest.Mock).mockReturnValue(mockNavigation)

  jest.spyOn(Alert, "alert").mockImplementation((title, message, buttons) => {
    buttons?.[0]?.onPress?.()
  })
})

describe("NetworkErrorComponent", () => {
  it("does nothing when there is no network error", () => {
    render(<NetworkErrorComponent />)
    expect(mockToastShow).not.toHaveBeenCalled()
    expect(mockClearNetworkError).not.toHaveBeenCalled()
  })

  it("shows toast for server errors (500+)", async () => {
    const { rerender } = render(<NetworkErrorComponent />)

    ;(useNetworkError as jest.Mock).mockReturnValue({
      networkError: { statusCode: 500 },
      clearNetworkError: mockClearNetworkError,
    })

    rerender(<NetworkErrorComponent />)

    await waitFor(
      () => {
        expect(mockToastShow).toHaveBeenCalledWith({
          message: expect.any(Function),
          LL: expect.any(Object),
        })
        expect(mockClearNetworkError).toHaveBeenCalled()
      },
      { timeout: 1000, interval: 50 },
    )
  })

  it("shows toast for generic client errors (400-499) without specific code", async () => {
    const { rerender } = render(<NetworkErrorComponent />)

    ;(useNetworkError as jest.Mock).mockReturnValue({
      networkError: { statusCode: 403 },
      clearNetworkError: mockClearNetworkError,
    })

    rerender(<NetworkErrorComponent />)

    await waitFor(
      () => {
        expect(mockToastShow).toHaveBeenCalledWith({
          message: expect.any(Function),
          LL: expect.any(Object),
        })
        expect(mockClearNetworkError).toHaveBeenCalled()
      },
      { timeout: 1000 },
    )
  })

  it("handles InvalidAuthentication with multiple profiles - switches account", async () => {
    ;(KeyStoreWrapper.getSessionProfiles as jest.Mock).mockResolvedValue([
      { token: "current-token", username: "user1" },
      { token: "other-token", username: "user2" },
    ])

    const { rerender } = render(<NetworkErrorComponent />)

    ;(useNetworkError as jest.Mock).mockReturnValue({
      networkError: {
        statusCode: 401,
        result: { errors: [{ code: NetworkErrorCode.InvalidAuthentication }] },
      },
      token: "current-token",
      clearNetworkError: mockClearNetworkError,
    })

    rerender(<NetworkErrorComponent />)

    await waitFor(() => {
      expect(mockSaveToken).toHaveBeenCalledWith("other-token")
      expect(mockToastShow).toHaveBeenCalledWith({
        type: "success",
        message: "Switched account",
        LL: expect.any(Object),
      })
      expect(mockNavigate).toHaveBeenCalledWith("Primary")
      expect(mockClearNetworkError).toHaveBeenCalled()
    })
  })

  it("handles InvalidAuthentication with one profile - shows alert and navigates to getStarted", async () => {
    ;(KeyStoreWrapper.getSessionProfiles as jest.Mock).mockResolvedValue([
      { token: "current-token", username: "user1" },
    ])

    const { rerender } = render(<NetworkErrorComponent />)

    ;(useNetworkError as jest.Mock).mockReturnValue({
      networkError: { statusCode: 401 },
      token: "current-token",
      clearNetworkError: mockClearNetworkError,
    })

    rerender(<NetworkErrorComponent />)

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalled()
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: "getStarted" }],
      })
      expect(mockClearNetworkError).toHaveBeenCalled()
    })
  })

  it("handles InvalidAuthentication with no current token - logs out and navigates", async () => {
    ;(useAppConfig as jest.Mock).mockReturnValue({
      appConfig: { token: null },
      saveToken: mockSaveToken,
    })

    const { rerender } = render(<NetworkErrorComponent />)

    ;(useNetworkError as jest.Mock).mockReturnValue({
      networkError: { statusCode: 401 },
      clearNetworkError: mockClearNetworkError,
    })

    rerender(<NetworkErrorComponent />)

    await waitFor(
      () => {
        expect(mockLogout).toHaveBeenCalledWith()
        expect(mockReset).toHaveBeenCalledWith({
          index: 0,
          routes: [{ name: "getStarted" }],
        })
        expect(mockClearNetworkError).toHaveBeenCalled()
      },
      { timeout: 1000 },
    )
  })

  it("handles network connectivity error", async () => {
    const { rerender } = render(<NetworkErrorComponent />)

    ;(useNetworkError as jest.Mock).mockReturnValue({
      networkError: { message: "Network request failed" },
      clearNetworkError: mockClearNetworkError,
    })

    rerender(<NetworkErrorComponent />)

    await waitFor(
      () => {
        expect(mockToastShow).toHaveBeenCalledWith({
          message: expect.any(Function),
          LL: expect.any(Object),
        })
        expect(mockClearNetworkError).toHaveBeenCalled()
      },
      { timeout: 1000 },
    )
  })

  it("falls back to logout on error during token expiry handling", async () => {
    ;(KeyStoreWrapper.getSessionProfiles as jest.Mock).mockRejectedValue(
      new Error("Storage error"),
    )

    const { rerender } = render(<NetworkErrorComponent />)

    ;(useNetworkError as jest.Mock).mockReturnValue({
      networkError: { statusCode: 401 },
      token: "current-token",
      clearNetworkError: mockClearNetworkError,
    })

    rerender(<NetworkErrorComponent />)

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledWith()
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: "getStarted" }],
      })
      expect(mockClearNetworkError).toHaveBeenCalled()
    })
  })
})
