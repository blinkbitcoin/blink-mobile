import { renderHook, waitFor } from "@testing-library/react-native"

import { useAccountModeSync } from "@app/self-custodial/hooks/use-account-mode-sync"
import { getSelfCustodialAccountMode } from "@app/store/persistent-state/self-custodial-account-mode"
import { getSelfCustodialServerAccountMode } from "@app/store/persistent-state/self-custodial-server-account-mode"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { AccountMode } from "@app/types/account"

const mockSetLnurlServerMode = jest.fn()
const mockRecoverLnurlServerMode = jest.fn()
jest.mock("@app/self-custodial/lnurl-server-mode", () => ({
  setLnurlServerMode: (...args: unknown[]) => mockSetLnurlServerMode(...args),
  recoverLnurlServerMode: (...args: unknown[]) => mockRecoverLnurlServerMode(...args),
}))

let mockPersistentState: PersistentState = {
  schemaVersion: 20,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
  activeAccountId: "sc-1",
}
const mockUpdateState = jest.fn()
jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState,
    updateState: mockUpdateState,
  }),
}))

let mockAccountMode: AccountMode | null = AccountMode.Enhanced
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ accountMode: mockAccountMode }),
}))

const sdk = { id: "sdk" }
let mockSdk: typeof sdk | null = sdk
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ sdk: mockSdk }),
}))

/** The host of the self-custodial address, which is the LNURL server. */
const SERVER_URL = "https://staging.blink.sv"
jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => "regtest",
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const withConfirmedMode = (mode: AccountMode) => {
  mockPersistentState = {
    ...mockPersistentState,
    selfCustodialServerAccountModeByAccountId: { "sc-1": mode },
  }
}

describe("useAccountModeSync", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAccountMode = AccountMode.Enhanced
    mockSdk = sdk
    mockPersistentState = {
      schemaVersion: 20,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "",
      activeAccountId: "sc-1",
    }
    mockSetLnurlServerMode.mockResolvedValue(undefined)
    mockRecoverLnurlServerMode.mockResolvedValue(null)
  })

  it("pushes the chosen mode the server has never been told about", async () => {
    renderHook(() => useAccountModeSync())

    await waitFor(() => {
      expect(mockSetLnurlServerMode).toHaveBeenCalledWith({
        sdk,
        serverUrl: SERVER_URL,
        mode: AccountMode.Enhanced,
      })
    })
  })

  it("pushes Anon when the account switches away from a confirmed Enhanced", async () => {
    withConfirmedMode(AccountMode.Enhanced)
    mockAccountMode = AccountMode.Anon

    renderHook(() => useAccountModeSync())

    await waitFor(() => {
      expect(mockSetLnurlServerMode).toHaveBeenCalledWith(
        expect.objectContaining({ mode: AccountMode.Anon }),
      )
    })
  })

  /** Each Enhanced push spends a paid country lookup against a per-IP budget, so telling
   *  the server what it already stores would burn that budget for nothing. */
  it("stays quiet when the server already holds the chosen mode", async () => {
    withConfirmedMode(AccountMode.Enhanced)

    renderHook(() => useAccountModeSync())
    await Promise.resolve()

    expect(mockSetLnurlServerMode).not.toHaveBeenCalled()
  })

  it("does nothing for a custodial account, which has no mode", async () => {
    mockAccountMode = null

    renderHook(() => useAccountModeSync())
    await Promise.resolve()

    expect(mockSetLnurlServerMode).not.toHaveBeenCalled()
  })

  /** The mode is chosen on screens with no wallet yet (creation picks one before the
   *  wallet exists), so there is nothing to sign with until the SDK connects. */
  it("waits for a connected SDK before pushing", async () => {
    mockSdk = null

    renderHook(() => useAccountModeSync())
    await Promise.resolve()

    expect(mockSetLnurlServerMode).not.toHaveBeenCalled()
  })

  it("does nothing while no self-custodial account is active", async () => {
    mockPersistentState = { ...mockPersistentState, activeAccountId: undefined }

    renderHook(() => useAccountModeSync())
    await Promise.resolve()

    expect(mockSetLnurlServerMode).not.toHaveBeenCalled()
  })

  it("records the confirmed mode against the account", async () => {
    renderHook(() => useAccountModeSync())

    await waitFor(() => expect(mockUpdateState).toHaveBeenCalledTimes(1))

    const updater = mockUpdateState.mock.calls[0][0]
    expect(getSelfCustodialServerAccountMode(updater(mockPersistentState), "sc-1")).toBe(
      AccountMode.Enhanced,
    )
    expect(updater(undefined)).toBeUndefined()
  })

  /** A push that never landed has to stay owed, or the next launch would take the
   *  server's silence for agreement. */
  it("leaves the account unconfirmed when the push fails", async () => {
    const failure = new Error("server refused")
    mockSetLnurlServerMode.mockRejectedValue(failure)

    renderHook(() => useAccountModeSync())

    await waitFor(() => {
      expect(mockReportError).toHaveBeenCalledWith("lnurl server mode sync", failure)
    })
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  /**
   * An account can reach a connected wallet holding no mode at all: created before the
   * modes existed, or provisioned on another device. The server is asked before anything
   * is assumed, because the same wallet may already be Anon somewhere else.
   */
  describe("an account that holds no mode yet", () => {
    beforeEach(() => {
      mockAccountMode = null
    })

    it("asks the server what it holds instead of assuming", async () => {
      renderHook(() => useAccountModeSync())

      await waitFor(() => {
        expect(mockRecoverLnurlServerMode).toHaveBeenCalledWith({
          sdk,
          serverUrl: SERVER_URL,
        })
      })
    })

    it("adopts the Anon the server holds rather than defaulting it away", async () => {
      mockRecoverLnurlServerMode.mockResolvedValue(AccountMode.Anon)

      renderHook(() => useAccountModeSync())

      await waitFor(() => expect(mockUpdateState).toHaveBeenCalledTimes(1))

      const state = mockUpdateState.mock.calls[0][0](mockPersistentState)
      expect(getSelfCustodialAccountMode(state)).toBe(AccountMode.Anon)
      expect(getSelfCustodialServerAccountMode(state, "sc-1")).toBe(AccountMode.Anon)
    })

    it("settles on Enhanced when the server holds none", async () => {
      renderHook(() => useAccountModeSync())

      await waitFor(() => expect(mockUpdateState).toHaveBeenCalledTimes(1))

      const state = mockUpdateState.mock.calls[0][0](mockPersistentState)
      expect(getSelfCustodialAccountMode(state)).toBe(AccountMode.Enhanced)
    })

    /** Left unconfirmed on purpose: the server never said Enhanced, so it is still owed
     *  that push. */
    it("leaves an assumed Enhanced unconfirmed so the push still happens", async () => {
      renderHook(() => useAccountModeSync())

      await waitFor(() => expect(mockUpdateState).toHaveBeenCalledTimes(1))

      const state = mockUpdateState.mock.calls[0][0](mockPersistentState)
      expect(getSelfCustodialServerAccountMode(state, "sc-1")).toBeNull()
    })

    it("pushes nothing while the mode is still unknown", async () => {
      renderHook(() => useAccountModeSync())
      await Promise.resolve()

      expect(mockSetLnurlServerMode).not.toHaveBeenCalled()
    })

    /** An unanswered server must leave the account exactly as it was: writing a default
     *  would push it over whatever the server really holds. */
    it("writes nothing when the server cannot be asked", async () => {
      const failure = new Error("server down")
      mockRecoverLnurlServerMode.mockRejectedValue(failure)

      renderHook(() => useAccountModeSync())

      await waitFor(() => {
        expect(mockReportError).toHaveBeenCalledWith("lnurl server mode resolve", failure)
      })
      expect(mockUpdateState).not.toHaveBeenCalled()
    })

    it("leaves the state alone when there is none to settle", async () => {
      renderHook(() => useAccountModeSync())

      await waitFor(() => expect(mockUpdateState).toHaveBeenCalledTimes(1))

      expect(mockUpdateState.mock.calls[0][0](undefined)).toBeUndefined()
    })

    it("does nothing while no self-custodial account is active", async () => {
      mockPersistentState = { ...mockPersistentState, activeAccountId: undefined }

      renderHook(() => useAccountModeSync())
      await Promise.resolve()

      expect(mockRecoverLnurlServerMode).not.toHaveBeenCalled()
    })

    it("waits for a connected SDK", async () => {
      mockSdk = null

      renderHook(() => useAccountModeSync())
      await Promise.resolve()

      expect(mockRecoverLnurlServerMode).not.toHaveBeenCalled()
    })
  })

  /** Already settled, so there is nothing to ask: asking anyway would spend a paid
   *  country lookup per launch. */
  it("never asks the server about an account that already holds a mode", async () => {
    withConfirmedMode(AccountMode.Enhanced)

    renderHook(() => useAccountModeSync())
    await Promise.resolve()

    expect(mockRecoverLnurlServerMode).not.toHaveBeenCalled()
  })

  it("pushes once rather than on every render", async () => {
    const { rerender } = renderHook(() => useAccountModeSync())

    await waitFor(() => expect(mockSetLnurlServerMode).toHaveBeenCalledTimes(1))
    rerender(undefined)

    expect(mockSetLnurlServerMode).toHaveBeenCalledTimes(1)
  })
})
