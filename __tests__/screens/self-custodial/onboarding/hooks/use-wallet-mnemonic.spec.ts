import { act, renderHook, waitFor } from "@testing-library/react-native"

import {
  useWalletIdentity,
  useWalletMnemonic,
  useWalletMnemonicState,
} from "@app/screens/self-custodial/onboarding/hooks/use-wallet-mnemonic"
import { AccountType } from "@app/types/wallet"

const mockGetMnemonicForAccount = jest.fn()
const mockUseActiveWallet = jest.fn()
const mockUseAccountRegistry = jest.fn()
const mockUseMigrationCheckpoint = jest.fn()
const mockDeriveWalletIdentityPubkey = jest.fn()
const mockReportError = jest.fn()
const mockNetwork = "regtest"

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

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

jest.mock("@app/screens/account-migration/hooks/use-migration-checkpoint-state", () => ({
  useMigrationCheckpointState: () => mockUseMigrationCheckpoint(),
}))

jest.mock("@app/self-custodial/bridge", () => ({
  ...jest.requireActual("@app/self-custodial/bridge"),
  deriveWalletIdentityPubkey: (mnemonic: string, network: string) =>
    mockDeriveWalletIdentityPubkey(mnemonic, network),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => mockNetwork,
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

  it("returns empty string when no self-custodial account is active", async () => {
    setNoActiveAccount()

    const { result } = renderHook(() => useWalletMnemonic())

    await waitFor(() => {
      expect(result.current).toBe("")
    })
    expect(mockGetMnemonicForAccount).not.toHaveBeenCalled()
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

describe("useWalletMnemonicState", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseMigrationCheckpoint.mockReturnValue({ accountId: null })
  })

  it("reports loading until the keychain read settles", async () => {
    setActiveSelfCustodial()
    let resolveRead: (value: string) => void = () => {}
    mockGetMnemonicForAccount.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveRead = resolve
      }),
    )

    const { result } = renderHook(() => useWalletMnemonicState())

    expect(result.current).toEqual({ mnemonic: "", loading: true })

    await act(async () => {
      resolveRead("word1 word2 word3")
    })

    await waitFor(() => {
      expect(result.current).toEqual({
        mnemonic: "word1 word2 word3",
        loading: false,
      })
    })
  })

  /** A stored-but-empty phrase must settle to loading:false, or consumers can never tell
   *  it apart from a read still in flight and the CTA stays disabled forever. */
  it("settles with loading false when no phrase is stored", async () => {
    setActiveSelfCustodial()
    mockGetMnemonicForAccount.mockResolvedValue(null)

    const { result } = renderHook(() => useWalletMnemonicState())

    await waitFor(() => {
      expect(result.current).toEqual({ mnemonic: "", loading: false })
    })
  })

  it("settles with loading false when there is no account to read", async () => {
    setNoActiveAccount()

    const { result } = renderHook(() => useWalletMnemonicState())

    await waitFor(() => {
      expect(result.current).toEqual({ mnemonic: "", loading: false })
    })
    expect(mockGetMnemonicForAccount).not.toHaveBeenCalled()
  })

  it("settles with loading false when the keychain read rejects", async () => {
    setActiveSelfCustodial()
    mockGetMnemonicForAccount.mockRejectedValue(new Error("keychain locked"))

    const { result } = renderHook(() => useWalletMnemonicState())

    await waitFor(() => {
      expect(result.current).toEqual({ mnemonic: "", loading: false })
    })
  })
})

describe("useWalletIdentity", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDeriveWalletIdentityPubkey.mockResolvedValue("derived-pubkey")
  })

  it("derives the identity pubkey from the mnemonic, reporting loading until it settles", async () => {
    const { result } = renderHook(() => useWalletIdentity("youth indicate void"))

    expect(result.current).toEqual({ pubkey: "", loading: true })

    await waitFor(() =>
      expect(result.current).toEqual({ pubkey: "derived-pubkey", loading: false }),
    )
    expect(mockDeriveWalletIdentityPubkey).toHaveBeenCalledWith(
      "youth indicate void",
      mockNetwork,
    )
  })

  it("returns an empty pubkey and skips derivation while the mnemonic is empty", () => {
    const { result } = renderHook(() => useWalletIdentity(""))

    expect(result.current).toEqual({ pubkey: "", loading: false })
    expect(mockDeriveWalletIdentityPubkey).not.toHaveBeenCalled()
  })

  it("settles to an empty pubkey when derivation rejects, and reports it", async () => {
    const derivationError = new Error("signer failed")
    mockDeriveWalletIdentityPubkey.mockRejectedValue(derivationError)

    const { result } = renderHook(() => useWalletIdentity("youth indicate void"))

    await waitFor(() => expect(result.current).toEqual({ pubkey: "", loading: false }))
    expect(mockReportError).toHaveBeenCalledWith(
      "deriveWalletIdentityPubkey",
      derivationError,
    )
  })

  /** The window this closes: with `loading` stored by the effect, the render that swaps the
   *  phrase still reported loading:false next to the previous wallet's pubkey, so a backup
   *  started in that frame wrote wallet B's phrase under wallet A's identity. */
  it("never pairs a phrase with the pubkey of the previous one", async () => {
    const { result, rerender } = renderHook(
      ({ m }: { m: string }) => useWalletIdentity(m),
      { initialProps: { m: "youth indicate void" } },
    )
    await waitFor(() =>
      expect(result.current).toEqual({ pubkey: "derived-pubkey", loading: false }),
    )

    mockDeriveWalletIdentityPubkey.mockReturnValue(new Promise(() => {}))
    rerender({ m: "other mnemonic words" })

    expect(result.current).toEqual({ pubkey: "", loading: true })
  })

  it("keeps the same object identity across renders that change nothing", async () => {
    const { result, rerender } = renderHook(
      ({ m }: { m: string }) => useWalletIdentity(m),
      { initialProps: { m: "youth indicate void" } },
    )
    await waitFor(() => expect(result.current.pubkey).toBe("derived-pubkey"))
    const settled = result.current

    rerender({ m: "youth indicate void" })

    expect(result.current).toBe(settled)
  })

  it("derives once per mnemonic and re-derives when it changes", async () => {
    const { result, rerender } = renderHook(
      ({ m }: { m: string }) => useWalletIdentity(m),
      { initialProps: { m: "youth indicate void" } },
    )
    await waitFor(() => expect(result.current.pubkey).toBe("derived-pubkey"))
    rerender({ m: "youth indicate void" })

    expect(mockDeriveWalletIdentityPubkey).toHaveBeenCalledTimes(1)

    mockDeriveWalletIdentityPubkey.mockResolvedValue("other-pubkey")
    rerender({ m: "other mnemonic words" })

    await waitFor(() => expect(result.current.pubkey).toBe("other-pubkey"))
    expect(mockDeriveWalletIdentityPubkey).toHaveBeenCalledTimes(2)
  })

  it("does not set state when unmounted before the derivation resolves", async () => {
    let resolveDerivation: (pubkey: string) => void = () => {}
    mockDeriveWalletIdentityPubkey.mockReturnValue(
      new Promise((resolve) => {
        resolveDerivation = resolve
      }),
    )
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {})

    try {
      const { unmount } = renderHook(() => useWalletIdentity("youth indicate void"))
      unmount()
      resolveDerivation("derived-pubkey")

      /** Flush the microtask queue; a state write after unmount would surface as a
       *  React act()/update warning through console.error. */
      await new Promise(process.nextTick)

      expect(consoleError).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
  })
})
