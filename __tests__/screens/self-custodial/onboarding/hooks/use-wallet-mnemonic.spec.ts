import { renderHook, waitFor } from "@testing-library/react-native"

import { useWalletMnemonic } from "@app/screens/self-custodial/onboarding/hooks/use-wallet-mnemonic"
import { AccountType } from "@app/types/wallet"

const mockGetMnemonicForAccount = jest.fn()
const mockUseActiveWallet = jest.fn()
const mockUseAccountRegistry = jest.fn()
const mockUseMigrationCheckpoint = jest.fn()

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

jest.mock("@app/screens/account-migration/hooks/use-migration-checkpoint", () => ({
  useMigrationCheckpoint: () => mockUseMigrationCheckpoint(),
}))

const ACCOUNT_ID = "self-custodial-uuid-1"
const MIGRATION_ACCOUNT_ID = "migration-uuid-2"

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
    mockUseMigrationCheckpoint.mockReturnValue({ accountId: null })
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

  it("reads the provisioned migration account while the active account is custodial", async () => {
    setNoActiveAccount()
    mockUseMigrationCheckpoint.mockReturnValue({ accountId: MIGRATION_ACCOUNT_ID })
    mockGetMnemonicForAccount.mockResolvedValue("alpha beta gamma")

    const { result } = renderHook(() => useWalletMnemonic())

    await waitFor(() => {
      expect(result.current).toBe("alpha beta gamma")
    })
    expect(mockGetMnemonicForAccount).toHaveBeenCalledWith(MIGRATION_ACCOUNT_ID)
  })

  it("ignores a stale migration checkpoint when a self-custodial account is active", async () => {
    setActiveSelfCustodial()
    mockUseMigrationCheckpoint.mockReturnValue({ accountId: MIGRATION_ACCOUNT_ID })
    mockGetMnemonicForAccount.mockResolvedValue("word1 word2 word3")

    const { result } = renderHook(() => useWalletMnemonic())

    await waitFor(() => {
      expect(result.current).toBe("word1 word2 word3")
    })
    expect(mockGetMnemonicForAccount).toHaveBeenCalledWith(ACCOUNT_ID)
    expect(mockGetMnemonicForAccount).not.toHaveBeenCalledWith(MIGRATION_ACCOUNT_ID)
  })
})
