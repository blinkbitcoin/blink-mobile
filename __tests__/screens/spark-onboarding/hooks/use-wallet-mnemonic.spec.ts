import { renderHook, waitFor } from "@testing-library/react-native"

import {
  useWalletMnemonic,
  useWalletMnemonicWords,
} from "@app/screens/spark-onboarding/hooks/use-wallet-mnemonic"
import { AccountType } from "@app/types/wallet"

const mockGetMnemonicForAccount = jest.fn()
const mockUseActiveWallet = jest.fn()
const mockUseAccountRegistry = jest.fn()

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getMnemonicForAccount: (accountId: string) => mockGetMnemonicForAccount(accountId),
  },
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

const ACCOUNT_ID = "self-custodial-uuid-1"

const setActiveSelfCustodial = (): void => {
  mockUseActiveWallet.mockReturnValue({ isSelfCustodial: true })
  mockUseAccountRegistry.mockReturnValue({
    activeAccount: { id: ACCOUNT_ID, type: AccountType.SelfCustodial },
  })
}

const setNoActiveAccount = (): void => {
  mockUseActiveWallet.mockReturnValue({ isSelfCustodial: false })
  mockUseAccountRegistry.mockReturnValue({ activeAccount: undefined })
}

describe("useWalletMnemonic", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns empty string when no self-custodial account is active", () => {
    setNoActiveAccount()

    const { result } = renderHook(() => useWalletMnemonic())

    expect(result.current).toBe("")
  })

  it("loads mnemonic from keychain for the active account", async () => {
    setActiveSelfCustodial()
    mockGetMnemonicForAccount.mockResolvedValue("word1 word2 word3")

    const { result } = renderHook(() => useWalletMnemonic())

    await waitFor(() => {
      expect(result.current).toBe("word1 word2 word3")
    })
    expect(mockGetMnemonicForAccount).toHaveBeenCalledWith(ACCOUNT_ID)
  })

  it("keeps state empty when keychain returns null", async () => {
    setActiveSelfCustodial()
    mockGetMnemonicForAccount.mockResolvedValue(null)

    const { result } = renderHook(() => useWalletMnemonic())

    await waitFor(() => {
      expect(mockGetMnemonicForAccount).toHaveBeenCalled()
    })

    expect(result.current).toBe("")
  })
})

describe("useWalletMnemonicWords", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns empty array when no mnemonic", () => {
    setNoActiveAccount()

    const { result } = renderHook(() => useWalletMnemonicWords())

    expect(result.current).toEqual([])
  })

  it("splits mnemonic into words", async () => {
    setActiveSelfCustodial()
    mockGetMnemonicForAccount.mockResolvedValue("alpha beta gamma")

    const { result } = renderHook(() => useWalletMnemonicWords())

    await waitFor(() => {
      expect(result.current).toEqual(["alpha", "beta", "gamma"])
    })
  })
})
