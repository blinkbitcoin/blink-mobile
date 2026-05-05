import { act, renderHook } from "@testing-library/react-native"
import { Platform } from "react-native"

import { useBackupMethods } from "@app/screens/spark-onboarding/hooks/use-backup-methods"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

const mockSave = jest.fn()
let mockLoading = false

jest.mock("@app/hooks", () => ({
  CredentialError: {
    NoProvider: "no-provider",
    UserCancelled: "user-cancelled",
    Unsupported: "unsupported",
    Unknown: "unknown",
  },
  useCredentialBackup: () => ({
    save: mockSave,
    read: jest.fn(),
    loading: mockLoading,
  }),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

jest.mock("@app/hooks/use-wallet-mnemonic", () => ({
  useWalletMnemonic: () => "youth indicate void",
}))

let mockIdentityPubkey: string | null = "test-pubkey-1234"
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-info", () => ({
  useSelfCustodialAccountInfo: () => ({
    identityPubkey: mockIdentityPubkey,
    lightningAddress: null,
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      BackupScreen: {
        BackupMethod: {
          passwordManagerBackupSaved: () => "Backup saved",
          passwordManagerBackupFailed: () => "Failed to save backup",
          passwordManagerUnavailable: () => "No password manager available",
          iOSComingSoon: () => "Coming soon on iOS",
        },
      },
    },
  }),
}))

const mockSetBackupCompleted = jest.fn()
jest.mock("@app/self-custodial/providers/backup-state-provider", () => ({
  BackupMethod: {
    Cloud: "cloud",
    Keychain: "keychain",
    Manual: "manual",
  },
  useBackupState: () => ({
    setBackupCompleted: mockSetBackupCompleted,
  }),
}))

describe("useBackupMethods", () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    jest.clearAllMocks()
    mockLoading = false
    mockIdentityPubkey = "test-pubkey-1234"
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform })
  })

  afterAll(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform })
  })

  it("exposes credential manager loading state", () => {
    mockLoading = true
    const { result } = renderHook(() => useBackupMethods())
    expect(result.current.credentialLoading).toBe(true)
    expect(result.current.isDriveBackupAvailable).toBe(originalPlatform !== "ios")
  })

  describe("handleCredentialBackup", () => {
    it("bails out with a failure toast when identityPubkey is missing", async () => {
      mockIdentityPubkey = null
      const { result } = renderHook(() => useBackupMethods())

      await act(async () => {
        await result.current.handleCredentialBackup()
      })

      expect(mockSave).not.toHaveBeenCalled()
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to save backup" }),
      )
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("saves with the identity pubkey and navigates to success on completion", async () => {
      mockSave.mockResolvedValue({ success: true })
      const { result } = renderHook(() => useBackupMethods())

      await act(async () => {
        await result.current.handleCredentialBackup()
      })

      expect(mockSave).toHaveBeenCalledWith("test-pubkey-1234", "youth indicate void")
      expect(mockSetBackupCompleted).toHaveBeenCalledWith("keychain")
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ type: "success", message: "Backup saved" }),
      )
      expect(mockNavigate).toHaveBeenCalledWith("sparkBackupSuccessScreen")
    })

    it("stays silent when the user cancels", async () => {
      mockSave.mockResolvedValue({ success: false, error: "user-cancelled" })
      const { result } = renderHook(() => useBackupMethods())

      await act(async () => {
        await result.current.handleCredentialBackup()
      })

      expect(mockToastShow).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(mockSetBackupCompleted).not.toHaveBeenCalled()
    })

    it("shows the unavailable toast when no provider is configured", async () => {
      mockSave.mockResolvedValue({ success: false, error: "no-provider" })
      const { result } = renderHook(() => useBackupMethods())

      await act(async () => {
        await result.current.handleCredentialBackup()
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "No password manager available" }),
      )
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("shows the unavailable toast on unsupported platform", async () => {
      mockSave.mockResolvedValue({ success: false, error: "unsupported" })
      const { result } = renderHook(() => useBackupMethods())

      await act(async () => {
        await result.current.handleCredentialBackup()
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "No password manager available" }),
      )
    })

    it("shows the failure toast on unknown errors", async () => {
      mockSave.mockResolvedValue({ success: false, error: "unknown" })
      const { result } = renderHook(() => useBackupMethods())

      await act(async () => {
        await result.current.handleCredentialBackup()
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to save backup" }),
      )
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe("handleCloudBackup", () => {
    it("shows iOS-coming-soon toast on iOS", () => {
      Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" })
      const { result } = renderHook(() => useBackupMethods())

      act(() => {
        result.current.handleCloudBackup()
      })

      expect(result.current.isDriveBackupAvailable).toBe(false)
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Coming soon on iOS" }),
      )
      expect(mockNavigate).not.toHaveBeenCalledWith("sparkCloudBackupScreen")
    })

    it("navigates to the cloud backup screen on Android", () => {
      Object.defineProperty(Platform, "OS", { configurable: true, value: "android" })
      const { result } = renderHook(() => useBackupMethods())

      act(() => {
        result.current.handleCloudBackup()
      })

      expect(result.current.isDriveBackupAvailable).toBe(true)
      expect(mockNavigate).toHaveBeenCalledWith("sparkCloudBackupScreen")
    })
  })

  describe("handleManualBackup", () => {
    it("navigates to the alerts screen", () => {
      const { result } = renderHook(() => useBackupMethods())

      act(() => {
        result.current.handleManualBackup()
      })

      expect(mockNavigate).toHaveBeenCalledWith("sparkBackupAlertsScreen")
    })
  })
})
