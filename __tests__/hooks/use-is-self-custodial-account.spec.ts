import { renderHook } from "@testing-library/react-native"

import { useIsSelfCustodialAccount } from "@app/hooks/use-is-self-custodial-account"
import { AccountType, ActiveWalletStatus } from "@app/types/wallet"

const mockUseActiveWallet = jest.fn()

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

describe("useIsSelfCustodialAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("is true for a self-custodial account with a ready wallet", () => {
    mockUseActiveWallet.mockReturnValue({
      accountType: AccountType.SelfCustodial,
      status: ActiveWalletStatus.Ready,
      isSelfCustodial: true,
    })

    const { result } = renderHook(() => useIsSelfCustodialAccount())

    expect(result.current).toBe(true)
  })

  it("stays true while the wallet is loading or unavailable, unlike isSelfCustodial", () => {
    mockUseActiveWallet.mockReturnValue({
      accountType: AccountType.SelfCustodial,
      status: ActiveWalletStatus.Unavailable,
      // useActiveWallet withholds this until the wallet is usable.
      isSelfCustodial: false,
    })

    const { result } = renderHook(() => useIsSelfCustodialAccount())

    expect(result.current).toBe(true)
  })

  it("is false for a custodial account", () => {
    mockUseActiveWallet.mockReturnValue({
      accountType: AccountType.Custodial,
      status: ActiveWalletStatus.Ready,
      isSelfCustodial: false,
    })

    const { result } = renderHook(() => useIsSelfCustodialAccount())

    expect(result.current).toBe(false)
  })
})
