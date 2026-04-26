import { renderHook, act } from "@testing-library/react-native"

import {
  useRestoreWallet,
  RestoreWalletStatus,
} from "@app/screens/spark-onboarding/restore/hooks/use-restore-wallet"

const mockRestore = jest.fn()
const mockUpdateState = jest.fn()
const mockNavigate = jest.fn()
const mockDeleteMnemonic = jest.fn()
const mockRecordError = jest.fn()
const mockToastShow = jest.fn()
const mockReinitSdk = jest.fn()
const mockSetBackupCompleted = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  selfCustodialRestoreWallet: (...args: string[]) => mockRestore(...args),
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
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: { deleteMnemonic: () => mockDeleteMnemonic() },
}))

jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
  useSelfCustodialWallet: () => ({ retry: mockReinitSdk }),
}))

jest.mock("@app/self-custodial/providers/backup-state-provider", () => ({
  useBackupState: () => ({ setBackupCompleted: mockSetBackupCompleted }),
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
      },
    },
  }),
}))

describe("useRestoreWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRestore.mockResolvedValue(undefined)
    mockDeleteMnemonic.mockResolvedValue(true)
  })

  it("starts with idle status", () => {
    const { result } = renderHook(() => useRestoreWallet())

    expect(result.current.status).toBe(RestoreWalletStatus.Idle)
  })

  it("restores wallet and navigates on success", async () => {
    const { result } = renderHook(() => useRestoreWallet())

    await act(async () => {
      await result.current.restore("word1 word2 word3")
    })

    expect(mockRestore).toHaveBeenCalledWith("word1 word2 word3")
    expect(mockUpdateState).toHaveBeenCalledTimes(1)
    expect(mockReinitSdk).toHaveBeenCalledTimes(1)
    expect(mockSetBackupCompleted).toHaveBeenCalledWith("manual")
    expect(mockNavigate).toHaveBeenCalledWith("sparkBackupSuccessScreen")
  })

  it("sets error status and cleans up on failure", async () => {
    mockRestore.mockRejectedValue(new Error("restore failed"))

    const { result } = renderHook(() => useRestoreWallet())

    await act(async () => {
      await result.current.restore("bad mnemonic").catch(() => {})
    })

    expect(result.current.status).toBe(RestoreWalletStatus.Error)
    expect(mockDeleteMnemonic).toHaveBeenCalledTimes(1)
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

  it("second restore call while first is in-flight still calls bridge", async () => {
    let resolveFirst: () => void
    mockRestore.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve
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

    expect(mockRestore).toHaveBeenCalledTimes(2)

    await act(async () => {
      resolveFirst!()
    })
  })

  it("sets restoring status during restore", async () => {
    let resolveRestore: () => void
    mockRestore.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveRestore = resolve
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
