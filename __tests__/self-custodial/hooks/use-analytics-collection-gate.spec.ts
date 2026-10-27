import { it } from "@jest/globals"
import { renderHook } from "@testing-library/react-native"

import { AnalyticsDomain } from "@app/self-custodial/analytics-identity"
import { useAnalyticsCollectionGate } from "@app/self-custodial/hooks/use-analytics-collection-gate"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { AccountMode } from "@app/types/account"

const mockSetAnalyticsDomain = jest.fn()

jest.mock("@app/self-custodial/analytics-identity", () => ({
  ...jest.requireActual("@app/self-custodial/analytics-identity"),
  setAnalyticsDomain: (...args: unknown[]) => mockSetAnalyticsDomain(...args),
}))

const custodialState: PersistentState = {
  schemaVersion: 21,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
  activeAccountId: "custodial-default",
}

let mockPersistentState: PersistentState = custodialState

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState,
    updateState: jest.fn(),
  }),
}))

const withSelfCustodialActive = (mode: AccountMode | null) => {
  mockPersistentState = {
    ...custodialState,
    activeAccountId: "sc-1",
    selfCustodialAccountModeByAccountId: mode ? { "sc-1": mode } : {},
  }
}

describe("useAnalyticsCollectionGate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPersistentState = custodialState
  })

  it.each([
    ["custodial is active", () => undefined, AnalyticsDomain.Custodial],
    [
      "an Incognito account is active",
      () => withSelfCustodialActive(AccountMode.Anon),
      AnalyticsDomain.Anon,
    ],
    [
      "an Enhanced account is active",
      () => withSelfCustodialActive(AccountMode.Enhanced),
      AnalyticsDomain.Enhanced,
    ],
    [
      "a self-custodial account has no mode yet",
      () => withSelfCustodialActive(null),
      AnalyticsDomain.Unset,
    ],
  ])("reports %s", (_label, arrange, expected) => {
    arrange()

    renderHook(() => useAnalyticsCollectionGate())

    expect(mockSetAnalyticsDomain).toHaveBeenCalledTimes(1)
    expect(mockSetAnalyticsDomain).toHaveBeenCalledWith(expected)
  })

  it("reports again when the active account switches, and not on a plain re-render", () => {
    const { rerender } = renderHook(() => useAnalyticsCollectionGate())
    rerender({})
    expect(mockSetAnalyticsDomain).toHaveBeenCalledTimes(1)

    withSelfCustodialActive(AccountMode.Enhanced)
    rerender({})

    expect(mockSetAnalyticsDomain).toHaveBeenLastCalledWith(AnalyticsDomain.Enhanced)
    expect(mockSetAnalyticsDomain).toHaveBeenCalledTimes(2)
  })
})
