import { Network as mockSparkNetwork } from "@breeztech/breez-sdk-spark-react-native"
import { renderHook, act } from "@testing-library/react-native"

import {
  useRestoreWallet,
  RestoreWalletStatus,
} from "@app/screens/self-custodial/onboarding/restore/hooks/use-restore-wallet"
import { getSelfCustodialAccountMode } from "@app/store/persistent-state/self-custodial-account-mode"
import { getSelfCustodialServerAccountMode } from "@app/store/persistent-state/self-custodial-server-account-mode"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { AccountMode } from "@app/types/account"

const TEST_ACCOUNT_ID = "test-account-id-123"

const mockRestore = jest.fn()
const mockUpdateState = jest.fn()
const mockNavigate = jest.fn()
const mockRecordError = jest.fn()
const mockToastShow = jest.fn()
const mockReinitSdk = jest.fn()
const mockMarkBackupCompletedFor = jest.fn()
const mockReloadSelfCustodialAccounts = jest.fn()
const mockFindSelfCustodialAccountByMnemonic = jest.fn()
const mockValidateMnemonic = jest.fn().mockReturnValue(true)

jest.mock("bip39", () => ({
  validateMnemonic: (...args: string[]) => mockValidateMnemonic(...args),
}))

jest.mock("@app/utils/mnemonic", () => ({
  normalizeMnemonic: (m: string) => m.trim().toLowerCase().replace(/\s+/g, " "),
}))

jest.mock("react-native-quick-crypto", () => ({
  randomUUID: () => "test-account-id-123",
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => mockSparkNetwork.Regtest,
}))

jest.mock("@app/self-custodial/bridge", () => ({
  selfCustodialRestoreWallet: (...args: unknown[]) => mockRestore(...args),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ selfCustodialDepositClaimLeewayVbyte: 5 }),
}))

jest.mock("@app/self-custodial/storage/account-index", () => ({
  findSelfCustodialAccountByMnemonic: (...args: string[]) =>
    mockFindSelfCustodialAccountByMnemonic(...args),
  StorageReadStatus: { Ok: "ok", ReadFailed: "read-failed" },
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    reloadSelfCustodialAccounts: mockReloadSelfCustodialAccounts,
  }),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({ updateState: mockUpdateState }),
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: Error[]) => mockRecordError(...args),
  log: jest.fn(),
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ retry: mockReinitSdk }),
}))

jest.mock("@app/self-custodial/providers/backup-state", () => ({
  markBackupCompletedFor: (...args: unknown[]) => mockMarkBackupCompletedFor(...args),
  BackupMethod: { Manual: "manual", Recovery: "recovery" },
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      RestoreScreen: {
        restoreSuccess: () => "Restored",
        restoreFailed: () => "Failed",
        invalidMnemonic: () => "Invalid recovery phrase",
      },
    },
  }),
}))

describe("useRestoreWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRestore.mockResolvedValue({ serverMode: null, isServerModeKnown: true })
    mockReloadSelfCustodialAccounts.mockResolvedValue(undefined)
    mockFindSelfCustodialAccountByMnemonic.mockResolvedValue({ status: "ok", id: null })
    mockValidateMnemonic.mockReturnValue(true)
  })

  it("starts with idle status", () => {
    const { result } = renderHook(() => useRestoreWallet())

    expect(result.current.status).toBe(RestoreWalletStatus.Idle)
  })

  it("restores wallet with new account id and navigates on success", async () => {
    const { result } = renderHook(() => useRestoreWallet())

    await act(async () => {
      await result.current.restore("word1 word2 word3")
    })

    expect(mockRestore).toHaveBeenCalledWith({
      accountId: TEST_ACCOUNT_ID,
      mnemonic: "word1 word2 word3",
      network: mockSparkNetwork.Regtest,
      leewaySatPerVbyte: 5,
    })
    expect(mockReloadSelfCustodialAccounts).toHaveBeenCalledTimes(1)
    expect(mockUpdateState).toHaveBeenCalledTimes(2)
    expect(mockReinitSdk).toHaveBeenCalledTimes(1)
    expect(mockMarkBackupCompletedFor).toHaveBeenCalledWith(TEST_ACCOUNT_ID, "manual")
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSuccess")
  })

  it("activates an existing account when the mnemonic is already imported", async () => {
    mockFindSelfCustodialAccountByMnemonic.mockResolvedValue({
      status: "ok",
      id: "existing-id",
    })

    const { result } = renderHook(() => useRestoreWallet())

    await act(async () => {
      await result.current.restore("word1 word2 word3")
    })

    expect(mockRestore).not.toHaveBeenCalled()
    expect(mockUpdateState).toHaveBeenCalledTimes(1)
    expect(mockReinitSdk).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSuccess")
  })

  /**
   * A restored wallet gets its mode from the server, never from a fresh question: it was
   * chosen on a device this one may never have been, so asking again could only overwrite
   * a deliberate answer with a default.
   */
  describe("the mode a restored wallet comes back with", () => {
    const baseState: PersistentState = {
      schemaVersion: 20,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "",
      activeAccountId: TEST_ACCOUNT_ID,
    }

    const restoreAndReadState = async (serverMode: AccountMode | null) => {
      mockRestore.mockResolvedValue({ serverMode, isServerModeKnown: true })
      const { result } = renderHook(() => useRestoreWallet())

      await act(async () => {
        await result.current.restore("word1 word2 word3")
      })

      /** Applied in the order the hook queued them, which is what the store does. */
      return mockUpdateState.mock.calls.reduce(
        (state, [updater]) => updater(state) as PersistentState,
        baseState,
      )
    }

    it("adopts the Anon the server holds instead of asking", async () => {
      const state = await restoreAndReadState(AccountMode.Anon)

      expect(getSelfCustodialAccountMode(state)).toBe(AccountMode.Anon)
      expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSuccess")
    })

    it("adopts the Enhanced the server holds", async () => {
      const state = await restoreAndReadState(AccountMode.Enhanced)

      expect(getSelfCustodialAccountMode(state)).toBe(AccountMode.Enhanced)
    })

    /** Already on the server, so re-pushing it would spend a paid country lookup to say
     *  what it just told us. */
    it("records a recovered mode as already confirmed", async () => {
      const state = await restoreAndReadState(AccountMode.Anon)

      expect(getSelfCustodialServerAccountMode(state, TEST_ACCOUNT_ID)).toBe(
        AccountMode.Anon,
      )
    })

    it("falls back to Enhanced when the server holds no mode", async () => {
      const state = await restoreAndReadState(null)

      expect(getSelfCustodialAccountMode(state)).toBe(AccountMode.Enhanced)
    })

    /** Left unconfirmed on purpose: the server never said Enhanced, so the sync still
     *  owes it that push. */
    it("leaves an assumed Enhanced unconfirmed so the sync pushes it", async () => {
      const state = await restoreAndReadState(null)

      expect(getSelfCustodialServerAccountMode(state, TEST_ACCOUNT_ID)).toBeNull()
    })

    /** The one case that still asks. Defaulting here would push Enhanced back and
     *  overwrite an Anon the server holds but could not report. */
    it("asks when the server could not be reached at all", async () => {
      mockRestore.mockResolvedValue({ serverMode: null, isServerModeKnown: false })
      const { result } = renderHook(() => useRestoreWallet())

      await act(async () => {
        await result.current.restore("word1 word2 word3")
      })

      expect(mockNavigate).toHaveBeenCalledWith("selfCustodialChooseExperience", {
        onContinue: {
          route: "selfCustodialBackupSuccess",
          accountId: TEST_ACCOUNT_ID,
        },
      })
    })

    it("writes no mode at all when the server could not be reached", async () => {
      mockRestore.mockResolvedValue({ serverMode: null, isServerModeKnown: false })
      const { result } = renderHook(() => useRestoreWallet())

      await act(async () => {
        await result.current.restore("word1 word2 word3")
      })

      /** Only the activation write; nothing claims a mode the server never reported. */
      expect(mockUpdateState).toHaveBeenCalledTimes(1)
    })

    it("never sends a restore to the mode picker", async () => {
      await restoreAndReadState(AccountMode.Anon)

      expect(mockNavigate).not.toHaveBeenCalledWith(
        "selfCustodialChooseExperience",
        expect.anything(),
      )
    })

    it("makes the restored account the active one", async () => {
      mockRestore.mockResolvedValue({ serverMode: null, isServerModeKnown: true })
      const { result } = renderHook(() => useRestoreWallet())

      await act(async () => {
        await result.current.restore("word1 word2 word3")
      })

      const activate = mockUpdateState.mock.calls[0][0]
      expect(
        (activate({ ...baseState, activeAccountId: undefined }) as PersistentState)
          .activeAccountId,
      ).toBe(TEST_ACCOUNT_ID)
      expect(activate(undefined)).toBeUndefined()
    })

    it("leaves the state alone when there is none to update", async () => {
      mockRestore.mockResolvedValue({
        serverMode: AccountMode.Anon,
        isServerModeKnown: true,
      })
      const { result } = renderHook(() => useRestoreWallet())

      await act(async () => {
        await result.current.restore("word1 word2 word3")
      })

      expect(mockUpdateState.mock.calls[1][0](undefined)).toBeUndefined()
    })
  })

  it("aborts restore when the index lookup fails — never duplicates an existing account", async () => {
    // Repro: a transient AsyncStorage failure during the dedup lookup used to
    // surface as `null`, causing the restore flow to create a fresh account
    // and orphan the existing one.
    mockFindSelfCustodialAccountByMnemonic.mockResolvedValue({
      status: "read-failed",
      error: new Error("AsyncStorage unavailable"),
    })

    const { result } = renderHook(() => useRestoreWallet())

    await act(async () => {
      await result.current.restore("word1 word2 word3").catch(() => {})
    })

    expect(mockRestore).not.toHaveBeenCalled()
    expect(mockUpdateState).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(result.current.status).toBe(RestoreWalletStatus.Error)
    expect(mockRecordError).toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalled()
  })

  it("shows the invalid-mnemonic toast (NOT generic restoreFailed) when validation fails", async () => {
    mockValidateMnemonic.mockReturnValue(false)

    const { result } = renderHook(() => useRestoreWallet())

    await act(async () => {
      await result.current.restore("not a real bip39 phrase")
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid recovery phrase" }),
    )
    expect(result.current.status).toBe(RestoreWalletStatus.Error)
    expect(mockRestore).not.toHaveBeenCalled()
    expect(mockFindSelfCustodialAccountByMnemonic).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("does NOT report invalid-mnemonic to crashlytics — it's a user input error", async () => {
    mockValidateMnemonic.mockReturnValue(false)

    const { result } = renderHook(() => useRestoreWallet())

    await act(async () => {
      await result.current.restore("not a real bip39 phrase")
    })

    expect(mockRecordError).not.toHaveBeenCalled()
  })

  it("normalizes the mnemonic before validation so leading whitespace doesn't trip the check", async () => {
    const { result } = renderHook(() => useRestoreWallet())

    await act(async () => {
      await result.current.restore("  WORD1   WORD2 word3  ")
    })

    expect(mockValidateMnemonic).toHaveBeenCalledWith("word1 word2 word3")
  })

  it("sets error status and reports on failure", async () => {
    mockRestore.mockRejectedValue(new Error("restore failed"))

    const { result } = renderHook(() => useRestoreWallet())

    await act(async () => {
      await result.current.restore("bad mnemonic").catch(() => {})
    })

    expect(result.current.status).toBe(RestoreWalletStatus.Error)
    expect(mockRecordError).toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalled()
  })

  it("wraps non-Error rejection for crashlytics", async () => {
    mockRestore.mockRejectedValue("string error")

    const { result } = renderHook(() => useRestoreWallet())

    await act(async () => {
      await result.current.restore("mnemonic").catch(() => {})
    })

    expect(mockRecordError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("string error") }),
    )
  })

  it("ignores reentrant restore while one is already in flight", async () => {
    let resolveFirst: () => void
    mockRestore.mockImplementationOnce(
      () =>
        new Promise<{ serverMode: null; isServerModeKnown: boolean }>((resolve) => {
          resolveFirst = () => resolve({ serverMode: null, isServerModeKnown: true })
        }),
    )

    const { result } = renderHook(() => useRestoreWallet())

    act(() => {
      result.current.restore("mnemonic1")
    })

    expect(result.current.status).toBe(RestoreWalletStatus.Restoring)

    await act(async () => {
      await result.current.restore("mnemonic2")
    })

    expect(mockRestore).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFirst!()
    })
  })

  it("sets restoring status during restore", async () => {
    let resolveRestore: () => void
    mockRestore.mockReturnValue(
      new Promise<{ serverMode: null; isServerModeKnown: boolean }>((resolve) => {
        resolveRestore = () => resolve({ serverMode: null, isServerModeKnown: true })
      }),
    )

    const { result } = renderHook(() => useRestoreWallet())

    act(() => {
      result.current.restore("mnemonic")
    })

    expect(result.current.status).toBe(RestoreWalletStatus.Restoring)

    await act(async () => {
      resolveRestore!()
    })
  })
})
