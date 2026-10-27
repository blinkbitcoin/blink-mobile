import { renderHook, waitFor } from "@testing-library/react-native"

import { useAnalyticsCollectionGate } from "@app/self-custodial/hooks/use-analytics-collection-gate"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { AccountMode } from "@app/types/account"

const mockSetAnalyticsCollectionEnabled = jest.fn()
const mockSetUserId = jest.fn()
const mockSetUserProperty = jest.fn()

jest.mock("@react-native-firebase/analytics", () => () => ({
  setAnalyticsCollectionEnabled: (...args: unknown[]) =>
    mockSetAnalyticsCollectionEnabled(...args),
  setUserId: (...args: unknown[]) => mockSetUserId(...args),
  setUserProperty: (...args: unknown[]) => mockSetUserProperty(...args),
}))

jest.mock("@app/self-custodial/telemetry-instance-id", () => ({
  getTelemetryInstanceId: () => Promise.resolve("install-uuid"),
}))

let mockPersistentState: PersistentState = {
  schemaVersion: 21,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
  activeAccountId: "custodial-default",
}

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState,
    updateState: jest.fn(),
  }),
}))

const withSelfCustodialActive = (mode: AccountMode | null) => {
  mockPersistentState = {
    ...mockPersistentState,
    activeAccountId: "sc-1",
    selfCustodialAccountModeByAccountId: mode ? { "sc-1": mode } : {},
  }
}

describe("useAnalyticsCollectionGate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPersistentState = {
      schemaVersion: 21,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "",
      activeAccountId: "custodial-default",
    }
  })

  it("keeps collection on and labels the mode while custodial is active", () => {
    renderHook(() => useAnalyticsCollectionGate())

    expect(mockSetAnalyticsCollectionEnabled).toHaveBeenCalledWith(true)
    expect(mockSetUserProperty).toHaveBeenCalledWith("account_mode", "custodial")
    expect(mockSetUserId).not.toHaveBeenCalled()
  })

  it("detaches identity and stops collection for an Incognito account, in that order", () => {
    withSelfCustodialActive(AccountMode.Anon)

    renderHook(() => useAnalyticsCollectionGate())

    expect(mockSetUserId).toHaveBeenCalledWith(null)
    expect(mockSetAnalyticsCollectionEnabled).toHaveBeenCalledWith(false)
    const detachOrder = mockSetUserId.mock.invocationCallOrder[0]
    const disableOrder = mockSetAnalyticsCollectionEnabled.mock.invocationCallOrder[0]
    expect(detachOrder).toBeLessThan(disableOrder)
  })

  it("reports the per-install id and enhanced label for an Enhanced account", async () => {
    withSelfCustodialActive(AccountMode.Enhanced)

    renderHook(() => useAnalyticsCollectionGate())

    expect(mockSetAnalyticsCollectionEnabled).toHaveBeenCalledWith(true)
    expect(mockSetUserProperty).toHaveBeenCalledWith("account_mode", "enhanced")
    await waitFor(() => expect(mockSetUserId).toHaveBeenCalledWith("install-uuid"))
  })

  it("fails closed on identity while the mode is unset", () => {
    withSelfCustodialActive(null)

    renderHook(() => useAnalyticsCollectionGate())

    expect(mockSetAnalyticsCollectionEnabled).toHaveBeenCalledWith(true)
    expect(mockSetUserId).toHaveBeenCalledWith(null)
    expect(mockSetUserProperty).not.toHaveBeenCalled()
  })
})
