import React from "react"
import { render, waitFor } from "@testing-library/react-native"
import { Alert } from "react-native"

import { useI18nContext } from "@app/i18n/i18n-react"
import useLogout from "@app/hooks/use-logout"
import { useReturnToGate } from "@app/hooks/use-return-to-gate"
import { useAppConfig } from "@app/hooks"
import { toastShow } from "@app/utils/toast"
import { useNavigation } from "@react-navigation/native"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { useNetworkError } from "@app/graphql/network-error-context"
import { NetworkErrorCode } from "@app/graphql/error-code"
import { NetworkErrorComponent } from "@app/graphql/network-error-component"

jest.mock("@app/graphql/network-error-context")
jest.mock("@app/i18n/i18n-react")
jest.mock("@app/hooks/use-logout")
/** A factory, not an automock: building one would load the hook's module, and the lock
 *  context it imports pulls in native boot code. */
jest.mock("@app/hooks/use-return-to-gate", () => ({ useReturnToGate: jest.fn() }))
/** The profile switch runs for real here and asks whether the lock is up; these tests run
 *  with it down, where a switch opens the home screen as it always did. */
jest.mock("@app/navigation/navigation-container-wrapper", () => ({
  useAuthenticationContext: () => ({ isAppLocked: false }),
}))
jest.mock("@app/hooks")
jest.mock("@app/utils/toast")
jest.mock("@react-navigation/native")
jest.mock("@app/utils/storage/secureStorage")

let mockIsSelfCustodialActive = false

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({
    isSelfCustodial: mockIsSelfCustodialActive,
    activeWalletId: "current-custodial-id",
  }),
}))

const mockClearNetworkError = jest.fn()
const mockToastShow = toastShow as jest.Mock
const mockLogout = jest.fn()
const mockSaveToken = jest.fn()
const mockNavigate = jest.fn()
const mockReset = jest.fn()
/** Where a session the backend no longer accepts leaves for: the gate, lock raised. What
 *  that does is its own spec. */
const mockReturnToGate = jest.fn()

const mockNavigation = {
  navigate: mockNavigate,
  reset: mockReset,
}

const storeProfiles = (profiles: unknown[]) => {
  ;(KeyStoreWrapper.readSessionProfiles as jest.Mock).mockResolvedValue({
    status: "found",
    profiles,
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockIsSelfCustodialActive = false
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
  ;(useReturnToGate as jest.Mock).mockReturnValue(mockReturnToGate)
  ;(useAppConfig as jest.Mock).mockReturnValue({
    appConfig: { token: "current-token" },
    saveToken: mockSaveToken,
  })
  ;(useNavigation as jest.Mock).mockReturnValue(mockNavigation)
  storeProfiles([])

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
    storeProfiles([
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
      expect(mockLogout).toHaveBeenCalledWith({
        stateToDefault: false,
        token: "current-token",
        isValidToken: false,
      })
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

  it("handles InvalidAuthentication with one profile - shows alert and returns to the gate", async () => {
    storeProfiles([{ token: "current-token", username: "user1" }])

    const { rerender } = render(<NetworkErrorComponent />)

    ;(useNetworkError as jest.Mock).mockReturnValue({
      networkError: { statusCode: 401 },
      token: "current-token",
      clearNetworkError: mockClearNetworkError,
    })

    rerender(<NetworkErrorComponent />)

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalled()
      // Readable store, genuinely the last profile: the list goes with it.
      expect(mockLogout).toHaveBeenCalledWith({ preserveStoredCredentials: false })
      /** To the gate, never straight to the landing screen: the logout keeps the
       *  lock while the device still stores something it guards, and a 401 can
       *  land while the lock screen is the one on show. */
      expect(mockReturnToGate).toHaveBeenCalledTimes(1)
      expect(mockReset).not.toHaveBeenCalled()
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
        // A 401 with no active token can be a stale one arriving mid-switch,
        // so what is stored stays put.
        expect(mockLogout).toHaveBeenCalledWith({ preserveStoredCredentials: true })
        expect(mockReturnToGate).toHaveBeenCalledTimes(1)
        expect(mockReset).not.toHaveBeenCalled()
        expect(mockClearNetworkError).toHaveBeenCalled()
      },
      { timeout: 1000 },
    )
  })

  describe("while a self-custodial wallet is the one in use", () => {
    /** A dead custodial session is not this user's problem right now: they are in a
     *  wallet the backend does not sign in. Ending their session, or sending them back to
     *  the gate over it, would take them out of a wallet nothing was wrong with. */
    beforeEach(() => {
      mockIsSelfCustodialActive = true
    })

    it("leaves a stale 401 with no active token alone", async () => {
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

      await waitFor(() => {
        expect(mockClearNetworkError).toHaveBeenCalled()
      })
      expect(mockLogout).not.toHaveBeenCalled()
      expect(mockReturnToGate).not.toHaveBeenCalled()
    })

    it("signs the dead custodial session out quietly, without leaving the wallet", async () => {
      storeProfiles([{ token: "current-token", username: "user1" }])
      const { rerender } = render(<NetworkErrorComponent />)

      ;(useNetworkError as jest.Mock).mockReturnValue({
        networkError: { statusCode: 401 },
        token: "current-token",
        clearNetworkError: mockClearNetworkError,
      })
      rerender(<NetworkErrorComponent />)

      await waitFor(() => {
        expect(mockClearNetworkError).toHaveBeenCalled()
      })
      expect(Alert.alert).not.toHaveBeenCalled()
      expect(mockReturnToGate).not.toHaveBeenCalled()
    })
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

  it("ignores InvalidAuthentication when networkErrorToken differs from current token", async () => {
    // The component logs the ignored stale-token 401 via console.debug;
    // capture it so the expected log doesn't pollute CI logs (and assert it
    // actually happened).
    const consoleDebugSpy = jest.spyOn(console, "debug").mockImplementation(() => {})
    const { rerender } = render(<NetworkErrorComponent />)

    ;(useNetworkError as jest.Mock).mockReturnValue({
      networkError: {
        statusCode: 401,
        result: { errors: [{ code: NetworkErrorCode.InvalidAuthentication }] },
      },
      token: "stale-token",
      clearNetworkError: mockClearNetworkError,
    })

    rerender(<NetworkErrorComponent />)

    await waitFor(() => {
      expect(mockLogout).not.toHaveBeenCalled()
      expect(mockClearNetworkError).toHaveBeenCalled()
    })
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      "Ignoring 401 for non-active token",
      expect.objectContaining({ networkErrorToken: "stale-token" }),
    )
    consoleDebugSpy.mockRestore()
  })

  it("falls back to logout on error during token expiry handling", async () => {
    // The component logs the simulated failure via console.error; capture it so
    // the expected error doesn't pollute CI logs (and assert it happened).
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    mockLogout.mockRejectedValueOnce(new Error("Storage error"))

    const { rerender } = render(<NetworkErrorComponent />)

    ;(useNetworkError as jest.Mock).mockReturnValue({
      networkError: { statusCode: 401 },
      token: "current-token",
      clearNetworkError: mockClearNetworkError,
    })

    rerender(<NetworkErrorComponent />)

    await waitFor(() => {
      // The teardown threw, so the saved list is kept rather than erased blind.
      expect(mockLogout).toHaveBeenCalledWith({ preserveStoredCredentials: true })
      expect(mockReturnToGate).toHaveBeenCalledTimes(1)
      expect(mockReset).not.toHaveBeenCalled()
      expect(mockClearNetworkError).toHaveBeenCalled()
    })
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error handling token expiry:",
      expect.objectContaining({ message: "Storage error" }),
    )
    consoleErrorSpy.mockRestore()
  })

  // The untokened logout erases every saved session. Reaching it because the
  // store could not be read would delete the profiles the read never saw.
  it("never runs the session-erasing logout when the profile store is unreadable", async () => {
    ;(KeyStoreWrapper.readSessionProfiles as jest.Mock).mockResolvedValue({
      status: "failed",
      err: new Error("keystore locked"),
    })

    const { rerender } = render(<NetworkErrorComponent />)

    ;(useNetworkError as jest.Mock).mockReturnValue({
      networkError: { statusCode: 401 },
      token: "current-token",
      clearNetworkError: mockClearNetworkError,
    })

    rerender(<NetworkErrorComponent />)

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalled()
      expect(mockReturnToGate).toHaveBeenCalledTimes(1)
    })
    expect(mockReset).not.toHaveBeenCalled()
    expect(mockLogout).toHaveBeenCalledWith({ preserveStoredCredentials: true })
    // The dead session's own token was still deactivated.
    expect(mockLogout).toHaveBeenCalledWith({
      stateToDefault: false,
      token: "current-token",
      isValidToken: false,
    })
  })
})
