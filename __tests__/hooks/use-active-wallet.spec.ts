import { renderHook } from "@testing-library/react-native"

import { AccountType, ActiveWalletStatus } from "@app/types/wallet.types"

import { useActiveWallet } from "@app/hooks/use-active-wallet"

const mockActiveAccount = jest.fn()
const mockAccounts = jest.fn()
const mockSetActiveAccountId = jest.fn()
const mockCustodialState = jest.fn()
const mockSelfCustodialState = jest.fn()

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: mockActiveAccount(),
    accounts: mockAccounts(),
    setActiveAccountId: mockSetActiveAccountId,
  }),
}))

jest.mock("@app/hooks/use-self-custodial-rollback", () => ({
  useSelfCustodialRollback: jest.fn(),
}))

jest.mock("@app/custodial/providers/wallet-provider", () => ({
  useCustodialWallet: () => mockCustodialState(),
}))

jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
  useSelfCustodialWallet: () => mockSelfCustodialState(),
}))

const custodialReady = {
  wallets: [],
  status: ActiveWalletStatus.Ready,
  accountType: AccountType.Custodial,
}

const selfCustodialReady = {
  wallets: [],
  status: ActiveWalletStatus.Ready,
  accountType: AccountType.SelfCustodial,
}

const selfCustodialUnavailable = {
  wallets: [],
  status: ActiveWalletStatus.Unavailable,
  accountType: AccountType.SelfCustodial,
}

describe("useActiveWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCustodialState.mockReturnValue(custodialReady)
    mockSelfCustodialState.mockReturnValue(selfCustodialUnavailable)
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
    expect(result.current.isReady).toBe(true)
    expect(result.current.isSelfCustodial).toBe(false)
    expect(result.current.needsBackendAuth).toBe(true)
  })

  it("returns self-custodial state when active account is self-custodial", () => {
    mockActiveAccount.mockReturnValue({
      id: "sc-default",
      type: AccountType.SelfCustodial,
    })
    mockSelfCustodialState.mockReturnValue(selfCustodialReady)

    const { result } = renderHook(() => useActiveWallet())

    expect(result.current.status).toBe(ActiveWalletStatus.Ready)
    expect(result.current.accountType).toBe(AccountType.SelfCustodial)
    expect(result.current.isReady).toBe(true)
    expect(result.current.isSelfCustodial).toBe(true)
    expect(result.current.needsBackendAuth).toBe(false)
  })

  it("isSelfCustodial is false when self-custodial but unavailable", () => {
    mockActiveAccount.mockReturnValue({
      id: "sc-default",
      type: AccountType.SelfCustodial,
    })
    mockSelfCustodialState.mockReturnValue(selfCustodialUnavailable)

    const { result } = renderHook(() => useActiveWallet())

    expect(result.current.isSelfCustodial).toBe(false)
  })

  it("returns unavailable custodial placeholder when no active account", () => {
    mockActiveAccount.mockReturnValue(undefined)

    const { result } = renderHook(() => useActiveWallet())

    expect(result.current.status).toBe(ActiveWalletStatus.Unavailable)
    expect(result.current.accountType).toBe(AccountType.Custodial)
    expect(result.current.isReady).toBe(false)
    expect(result.current.needsBackendAuth).toBe(true)
  })

  it("treats Degraded self-custodial as isReady=true so payments stay available (Important #5)", () => {
    mockActiveAccount.mockReturnValue({
      id: "sc-default",
      type: AccountType.SelfCustodial,
    })
    mockSelfCustodialState.mockReturnValue({
      wallets: [],
      status: ActiveWalletStatus.Degraded,
      accountType: AccountType.SelfCustodial,
    })

    const { result } = renderHook(() => useActiveWallet())

    expect(result.current.status).toBe(ActiveWalletStatus.Degraded)
    expect(result.current.isReady).toBe(true)
    expect(result.current.isSelfCustodial).toBe(true)
  })

  it("treats Degraded custodial as isReady=true (Important #5)", () => {
    mockActiveAccount.mockReturnValue({
      id: "custodial-default",
      type: AccountType.Custodial,
    })
    mockCustodialState.mockReturnValue({
      wallets: [],
      status: ActiveWalletStatus.Degraded,
      accountType: AccountType.Custodial,
    })

    const { result } = renderHook(() => useActiveWallet())

    expect(result.current.status).toBe(ActiveWalletStatus.Degraded)
    expect(result.current.isReady).toBe(true)
  })

  const nonReadyStatuses: ActiveWalletStatus[] = [
    ActiveWalletStatus.Loading,
    ActiveWalletStatus.Error,
    ActiveWalletStatus.Offline,
    ActiveWalletStatus.Unavailable,
  ]

  for (const status of nonReadyStatuses) {
    it(`flips isReady=false for non-Ready, non-Degraded status '${status}' (Important #5)`, () => {
      mockActiveAccount.mockReturnValue({
        id: "sc-default",
        type: AccountType.SelfCustodial,
      })
      mockSelfCustodialState.mockReturnValue({
        wallets: [],
        status,
        accountType: AccountType.SelfCustodial,
      })

      const { result } = renderHook(() => useActiveWallet())

      expect(result.current.status).toBe(status)
      expect(result.current.isReady).toBe(false)
    })
  }
})
