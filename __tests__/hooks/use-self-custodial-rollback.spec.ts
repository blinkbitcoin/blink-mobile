import { renderHook } from "@testing-library/react-native"

import { AccountStatus, AccountType } from "@app/types/wallet.types"

import { useSelfCustodialRollback } from "@app/hooks/use-self-custodial-rollback"

let mockNonCustodialEnabled = true
let mockGaloyAuthToken = ""

jest.mock("@app/config/feature-flags-context", () => ({
  useFeatureFlags: () => ({
    nonCustodialEnabled: mockNonCustodialEnabled,
  }),
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
  id: "sc-default",
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
})
