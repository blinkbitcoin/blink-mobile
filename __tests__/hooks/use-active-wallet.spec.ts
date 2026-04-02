import { renderHook } from "@testing-library/react-native"

import { AccountType, ActiveWalletStatus } from "@app/types/wallet.types"

import { useActiveWallet } from "@app/hooks/use-active-wallet"

const mockActiveAccount = jest.fn()
const mockAccounts = jest.fn()
const mockSetActiveAccountId = jest.fn()
const mockNonCustodialEnabled = jest.fn()
const mockCustodialState = jest.fn()

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: mockActiveAccount(),
    accounts: mockAccounts(),
    setActiveAccountId: mockSetActiveAccountId,
  }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useFeatureFlags: () => ({
    nonCustodialEnabled: mockNonCustodialEnabled(),
  }),
}))

jest.mock("@app/custodial/providers/wallet-provider", () => ({
  useCustodialWallet: () => mockCustodialState(),
}))

const custodialReady = {
  wallets: [],
  status: ActiveWalletStatus.Ready,
  accountType: AccountType.Custodial,
}

describe("useActiveWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockNonCustodialEnabled.mockReturnValue(true)
    mockCustodialState.mockReturnValue(custodialReady)
    mockAccounts.mockReturnValue([])
  })

  it("returns custodial state when active account is custodial", () => {
    mockActiveAccount.mockReturnValue({
      id: "custodial-default",
      type: AccountType.Custodial,
    })

    const { result } = renderHook(() => useActiveWallet())

    expect(result.current.status).toBe(ActiveWalletStatus.Ready)
    expect(result.current.accountType).toBe(AccountType.Custodial)
  })

  it("returns unavailable placeholder when active account is self-custodial", () => {
    mockActiveAccount.mockReturnValue({
      id: "self-custodial-default",
      type: AccountType.SelfCustodial,
    })

    const { result } = renderHook(() => useActiveWallet())

    expect(result.current.status).toBe(ActiveWalletStatus.Unavailable)
    expect(result.current.accountType).toBe(AccountType.SelfCustodial)
    expect(result.current.wallets).toHaveLength(0)
  })

  it("returns unavailable custodial placeholder when no active account", () => {
    mockActiveAccount.mockReturnValue(undefined)

    const { result } = renderHook(() => useActiveWallet())

    expect(result.current.status).toBe(ActiveWalletStatus.Unavailable)
    expect(result.current.accountType).toBe(AccountType.Custodial)
  })

  it("rolls back to custodial when flag disabled and active is self-custodial", () => {
    mockNonCustodialEnabled.mockReturnValue(false)
    mockActiveAccount.mockReturnValue({
      id: "self-custodial-default",
      type: AccountType.SelfCustodial,
    })
    mockAccounts.mockReturnValue([
      { id: "custodial-default", type: AccountType.Custodial },
    ])

    renderHook(() => useActiveWallet())

    expect(mockSetActiveAccountId).toHaveBeenCalledWith("custodial-default")
  })

  it("does not roll back when flag enabled", () => {
    mockNonCustodialEnabled.mockReturnValue(true)
    mockActiveAccount.mockReturnValue({
      id: "self-custodial-default",
      type: AccountType.SelfCustodial,
    })

    renderHook(() => useActiveWallet())

    expect(mockSetActiveAccountId).not.toHaveBeenCalled()
  })

  it("does not roll back when active account is custodial", () => {
    mockNonCustodialEnabled.mockReturnValue(false)
    mockActiveAccount.mockReturnValue({
      id: "custodial-default",
      type: AccountType.Custodial,
    })

    renderHook(() => useActiveWallet())

    expect(mockSetActiveAccountId).not.toHaveBeenCalled()
  })
})
