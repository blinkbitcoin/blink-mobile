import { renderHook } from "@testing-library/react-native"

import { AccountStatus, AccountType } from "@app/types/wallet"

import { useSelfCustodialRollback } from "@app/hooks/use-self-custodial-rollback"

let mockNonCustodialEnabled = true
let mockRemoteConfigReady = true
let mockHasCustodialAccount = true
let mockGaloyAuthToken = ""

jest.mock("@app/config/feature-flags-context", () => ({
  useFeatureFlags: () => ({
    nonCustodialEnabled: mockNonCustodialEnabled,
    remoteConfigReady: mockRemoteConfigReady,
  }),
}))

jest.mock("@app/hooks/use-has-custodial-account", () => ({
  useHasCustodialAccount: () => mockHasCustodialAccount,
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: { galoyAuthToken: mockGaloyAuthToken },
  }),
}))

const custodialAccount = {
  id: "custodial-default",
  type: AccountType.Custodial,
  label: "Custodial",
  selected: false,
  status: AccountStatus.Available,
}
const selfCustodialAccount = {
  id: "self-custodial-default",
  type: AccountType.SelfCustodial,
  label: "Self-custodial",
  selected: true,
  status: AccountStatus.Available,
}

describe("useSelfCustodialRollback", () => {
  const mockSetActiveAccountId = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockNonCustodialEnabled = true
    mockRemoteConfigReady = true
    mockHasCustodialAccount = true
    mockGaloyAuthToken = "auth-token"
  })

  it("rolls back when flag disabled and active is self-custodial", () => {
    mockNonCustodialEnabled = false

    renderHook(() =>
      useSelfCustodialRollback({
        activeAccount: selfCustodialAccount,
        accounts: [custodialAccount, selfCustodialAccount],
        setActiveAccountId: mockSetActiveAccountId,
      }),
    )

    expect(mockSetActiveAccountId).toHaveBeenCalledWith("custodial-default")
  })

  it("does not roll back when flag is enabled", () => {
    mockNonCustodialEnabled = true

    renderHook(() =>
      useSelfCustodialRollback({
        activeAccount: selfCustodialAccount,
        accounts: [custodialAccount, selfCustodialAccount],
        setActiveAccountId: mockSetActiveAccountId,
      }),
    )

    expect(mockSetActiveAccountId).not.toHaveBeenCalled()
  })

  it("does not roll back when active account is custodial", () => {
    mockNonCustodialEnabled = false

    renderHook(() =>
      useSelfCustodialRollback({
        activeAccount: custodialAccount,
        accounts: [custodialAccount],
        setActiveAccountId: mockSetActiveAccountId,
      }),
    )

    expect(mockSetActiveAccountId).not.toHaveBeenCalled()
  })

  it("does not roll back when no custodial fallback exists", () => {
    mockNonCustodialEnabled = false

    renderHook(() =>
      useSelfCustodialRollback({
        activeAccount: selfCustodialAccount,
        accounts: [selfCustodialAccount],
        setActiveAccountId: mockSetActiveAccountId,
      }),
    )

    expect(mockSetActiveAccountId).not.toHaveBeenCalled()
  })

  it("re-fires rollback on off→on→off flag toggle", () => {
    mockNonCustodialEnabled = false

    const { rerender } = renderHook(() =>
      useSelfCustodialRollback({
        activeAccount: selfCustodialAccount,
        accounts: [custodialAccount, selfCustodialAccount],
        setActiveAccountId: mockSetActiveAccountId,
      }),
    )

    expect(mockSetActiveAccountId).toHaveBeenCalledTimes(1)
    mockSetActiveAccountId.mockClear()

    mockNonCustodialEnabled = true
    rerender({})

    expect(mockSetActiveAccountId).not.toHaveBeenCalled()

    mockNonCustodialEnabled = false
    rerender({})

    expect(mockSetActiveAccountId).toHaveBeenCalledWith("custodial-default")
  })

  describe("cold-start race", () => {
    it("does not roll back while remoteConfigReady is false, even with the default flag value", () => {
      mockRemoteConfigReady = false
      mockNonCustodialEnabled = false

      renderHook(() =>
        useSelfCustodialRollback({
          activeAccount: selfCustodialAccount,
          accounts: [custodialAccount, selfCustodialAccount],
          setActiveAccountId: mockSetActiveAccountId,
        }),
      )

      expect(mockSetActiveAccountId).not.toHaveBeenCalled()
    })

    it("does not roll back when remote config arrives with the flag enabled", () => {
      mockRemoteConfigReady = false
      mockNonCustodialEnabled = false

      const { rerender } = renderHook(() =>
        useSelfCustodialRollback({
          activeAccount: selfCustodialAccount,
          accounts: [custodialAccount, selfCustodialAccount],
          setActiveAccountId: mockSetActiveAccountId,
        }),
      )

      expect(mockSetActiveAccountId).not.toHaveBeenCalled()

      mockRemoteConfigReady = true
      mockNonCustodialEnabled = true
      rerender({})

      expect(mockSetActiveAccountId).not.toHaveBeenCalled()
    })

    it("rolls back exactly once when remote config arrives with the flag disabled", () => {
      mockRemoteConfigReady = false
      mockNonCustodialEnabled = false

      const { rerender } = renderHook(() =>
        useSelfCustodialRollback({
          activeAccount: selfCustodialAccount,
          accounts: [custodialAccount, selfCustodialAccount],
          setActiveAccountId: mockSetActiveAccountId,
        }),
      )

      expect(mockSetActiveAccountId).not.toHaveBeenCalled()

      mockRemoteConfigReady = true
      rerender({})

      expect(mockSetActiveAccountId).toHaveBeenCalledTimes(1)
      expect(mockSetActiveAccountId).toHaveBeenCalledWith("custodial-default")
    })
  })

  describe("shouldShowUnavailable matrix", () => {
    type AnyAccount = typeof selfCustodialAccount | typeof custodialAccount
    const renderWith = (overrides: {
      activeAccount?: AnyAccount
      accounts?: AnyAccount[]
    }) =>
      renderHook(() =>
        useSelfCustodialRollback({
          activeAccount: overrides.activeAccount ?? selfCustodialAccount,
          accounts: overrides.accounts ?? [selfCustodialAccount],
          setActiveAccountId: mockSetActiveAccountId,
        }),
      )

    it("flag=disabled, active=self-custodial, no custodial available → true (locks user out)", () => {
      mockNonCustodialEnabled = false
      mockHasCustodialAccount = false

      const { result } = renderWith({ accounts: [selfCustodialAccount] })

      expect(result.current.shouldShowUnavailable).toBe(true)
    })

    it("flag=disabled, active=self-custodial, custodial available → false (rollback handles it)", () => {
      mockNonCustodialEnabled = false
      mockHasCustodialAccount = true

      const { result } = renderWith({
        accounts: [custodialAccount, selfCustodialAccount],
      })

      expect(result.current.shouldShowUnavailable).toBe(false)
    })

    it("flag=enabled → false regardless of custodial fallback", () => {
      mockNonCustodialEnabled = true
      mockHasCustodialAccount = false

      const { result } = renderWith({ accounts: [selfCustodialAccount] })

      expect(result.current.shouldShowUnavailable).toBe(false)
    })

    it("active account is custodial → false", () => {
      mockNonCustodialEnabled = false
      mockHasCustodialAccount = true

      const { result } = renderWith({
        activeAccount: custodialAccount,
        accounts: [custodialAccount],
      })

      expect(result.current.shouldShowUnavailable).toBe(false)
    })

    it("remote config not ready yet → false (avoid lockout flap during boot)", () => {
      mockRemoteConfigReady = false
      mockNonCustodialEnabled = false
      mockHasCustodialAccount = false

      const { result } = renderWith({ accounts: [selfCustodialAccount] })

      expect(result.current.shouldShowUnavailable).toBe(false)
    })

    it("transitions false → true on remote config arrival without flap", () => {
      mockRemoteConfigReady = false
      mockNonCustodialEnabled = false
      mockHasCustodialAccount = false

      const { result, rerender } = renderHook(() =>
        useSelfCustodialRollback({
          activeAccount: selfCustodialAccount,
          accounts: [selfCustodialAccount],
          setActiveAccountId: mockSetActiveAccountId,
        }),
      )

      expect(result.current.shouldShowUnavailable).toBe(false)

      mockRemoteConfigReady = true
      rerender({})

      expect(result.current.shouldShowUnavailable).toBe(true)
    })
  })
})
