import { renderHook, waitFor } from "@testing-library/react-native"

import { useEffectiveAuthToken } from "@app/graphql/hooks/use-effective-auth-token"
import { DefaultAccountId } from "@app/types/wallet"

let mockToken = "live-token"
let mockActiveAccountId: string | undefined

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: { token: mockToken, galoyInstance: { id: "Main" } },
  }),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: { activeAccountId: mockActiveAccountId, galoyAuthToken: mockToken },
  }),
}))

const mockListSelfCustodialAccounts = jest.fn()
jest.mock("@app/self-custodial/storage/account-index", () => ({
  listSelfCustodialAccounts: () => mockListSelfCustodialAccounts(),
  StorageReadStatus: { Ok: "ok", ReadFailed: "read-failed" },
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

describe("useEffectiveAuthToken", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockToken = "live-token"
    mockActiveAccountId = undefined
    // Default: self-custodial index resolves to a never-fulfilled state so synchronous tests
    // observe the optimistic pre-load behavior. Cases that need post-load state
    // override this in-test.
    mockListSelfCustodialAccounts.mockReturnValue(new Promise(() => {}))
  })

  it("returns the live token when no active account is set", () => {
    const { result } = renderHook(() => useEffectiveAuthToken())

    expect(result.current).toBe("live-token")
  })

  it("returns the live token when active account is custodial", () => {
    mockActiveAccountId = DefaultAccountId.Custodial

    const { result } = renderHook(() => useEffectiveAuthToken())

    expect(result.current).toBe("live-token")
  })

  it("returns an empty token when active account is self-custodial", () => {
    mockActiveAccountId = "self-custodial-uuid-1"

    const { result } = renderHook(() => useEffectiveAuthToken())

    expect(result.current).toBe("")
  })

  it("returns an empty token even if a custodial token is still saved", () => {
    // The architectural guarantee: self-custodial mode never lets the live
    // custodial token reach the Apollo client, regardless of whether the
    // KeyStore still holds it for later restore.
    mockToken = "still-saved-custodial"
    mockActiveAccountId = "self-custodial-uuid-1"

    const { result } = renderHook(() => useEffectiveAuthToken())

    expect(result.current).toBe("")
  })

  it("does not consult the self-custodial index when the active account is the custodial sentinel", () => {
    mockActiveAccountId = DefaultAccountId.Custodial

    renderHook(() => useEffectiveAuthToken())

    expect(mockListSelfCustodialAccounts).not.toHaveBeenCalled()
  })

  it("keeps the empty token once the self-custodial index confirms the active account is a real self-custodial entry", async () => {
    mockActiveAccountId = "self-custodial-uuid-1"
    mockListSelfCustodialAccounts.mockResolvedValue({
      status: "ok",
      entries: [{ id: "self-custodial-uuid-1", lightningAddress: null }],
    })

    const { result } = renderHook(() => useEffectiveAuthToken())

    await waitFor(() => {
      expect(mockListSelfCustodialAccounts).toHaveBeenCalled()
    })
    expect(result.current).toBe("")
  })

  it("falls back to the live custodial token when the active account id is an orphan not present in the self-custodial index", async () => {
    // Repro: a stale activeAccountId (legacy migration, corrupted index, etc.)
    // pointing at a UUID that no longer maps to any self-custodial entry would silently
    // strip Apollo auth — BackendFeatureGate then locks the user out with no
    // signal. The defensive check restores the custodial token so the user can
    // still operate.
    mockActiveAccountId = "orphan-uuid"
    mockListSelfCustodialAccounts.mockResolvedValue({
      status: "ok",
      entries: [{ id: "self-custodial-uuid-1", lightningAddress: null }],
    })

    const { result } = renderHook(() => useEffectiveAuthToken())

    await waitFor(() => {
      expect(result.current).toBe("live-token")
    })
  })

  it("falls back to the live custodial token when the self-custodial index read fails", async () => {
    // A permanent empty-token lockout (with no recovery path) is worse than
    // the brief window where backend-gated screens could see the user's own
    // custodial data. Failures are surfaced to crashlytics for diagnosis.
    mockActiveAccountId = "self-custodial-uuid-1"
    const readError = new Error("AsyncStorage unavailable")
    mockListSelfCustodialAccounts.mockResolvedValue({
      status: "read-failed",
      error: readError,
    })

    const { result } = renderHook(() => useEffectiveAuthToken())

    await waitFor(() => {
      expect(result.current).toBe("live-token")
    })
    expect(mockReportError).toHaveBeenCalledWith(
      "auth-token account-index read",
      readError,
    )
  })

  it("falls back to the live custodial token when the self-custodial index promise rejects", async () => {
    mockActiveAccountId = "self-custodial-uuid-1"
    const rejection = new Error("AsyncStorage threw")
    mockListSelfCustodialAccounts.mockRejectedValue(rejection)

    const { result } = renderHook(() => useEffectiveAuthToken())

    await waitFor(() => {
      expect(result.current).toBe("live-token")
    })
    expect(mockReportError).toHaveBeenCalledWith(
      "auth-token account-index read rejected",
      rejection,
    )
  })

  it("re-queries the self-custodial index when the active account id changes", async () => {
    mockActiveAccountId = "self-custodial-uuid-1"
    mockListSelfCustodialAccounts.mockResolvedValue({
      status: "ok",
      entries: [{ id: "self-custodial-uuid-1", lightningAddress: null }],
    })

    const { rerender } = renderHook(() => useEffectiveAuthToken())

    await waitFor(() => {
      expect(mockListSelfCustodialAccounts).toHaveBeenCalledTimes(1)
    })

    mockActiveAccountId = "self-custodial-uuid-2"
    rerender({})

    await waitFor(() => {
      expect(mockListSelfCustodialAccounts).toHaveBeenCalledTimes(2)
    })
  })
})
