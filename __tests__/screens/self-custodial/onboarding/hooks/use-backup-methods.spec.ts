import { act, renderHook } from "@testing-library/react-native"
import { Platform } from "react-native"

import { useBackupMethods } from "@app/screens/self-custodial/onboarding/hooks/use-backup-methods"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

const mockSave = jest.fn()
let mockLoading = false

const { isCredentialBackupAvailable: actualIsCredentialBackupAvailable } =
  jest.requireActual("@app/screens/self-custodial/onboarding/hooks/use-credential-backup")
jest.mock("@app/screens/self-custodial/onboarding/hooks/use-credential-backup", () => ({
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
  isCredentialBackupAvailable: (count: number) =>
    actualIsCredentialBackupAvailable(count),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

let mockIdentityPubkey: string | null = "test-pubkey-1234"
const mockLoadMnemonic = jest.fn()
jest.mock("@app/screens/self-custodial/onboarding/hooks/use-wallet-mnemonic", () => ({
  useLoadWalletMnemonic: () => mockLoadMnemonic,
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => "regtest",
}))

jest.mock("@app/self-custodial/bridge", () => ({
  deriveWalletIdentityPubkey: () => mockIdentityPubkey,
}))

const mockCompleteBackup = jest.fn()
jest.mock("@app/screens/self-custodial/onboarding/hooks/use-complete-backup", () => ({
  useCompleteBackup: () => mockCompleteBackup,
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

jest.mock("@app/self-custodial/providers/backup-state", () => ({
  BackupMethod: {
    Cloud: "cloud",
    Keychain: "keychain",
    Manual: "manual",
  },
}))

let mockSelfCustodialEntries: Array<{ id: string; lightningAddress: string | null }> = []
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    selfCustodialEntries: mockSelfCustodialEntries,
  }),
}))

describe("useBackupMethods", () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    jest.clearAllMocks()
    mockLoading = false
    mockIdentityPubkey = "test-pubkey-1234"
    mockLoadMnemonic.mockResolvedValue("youth indicate void")
    mockSelfCustodialEntries = [{ id: "self-custodial-1", lightningAddress: null }]
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform })
  })

  afterAll(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform })
  })

  it("exposes credential manager loading state", () => {
    mockLoading = true
    const { result } = renderHook(() => useBackupMethods())
    expect(result.current.credentialLoading).toBe(true)
  })

  describe("handleCredentialBackup", () => {
    it("reads the phrase only on the credential tap, never eagerly on mount", async () => {
      const { result } = renderHook(() => useBackupMethods())
      expect(mockLoadMnemonic).not.toHaveBeenCalled()

      mockSave.mockResolvedValue({ success: true })
      await act(async () => {
        await result.current.handleCredentialBackup()
      })

      expect(mockLoadMnemonic).toHaveBeenCalledTimes(1)
    })

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

    it("bails out with a failure toast when the phrase cannot be read", async () => {
      mockLoadMnemonic.mockResolvedValue("")
      const { result } = renderHook(() => useBackupMethods())

      await act(async () => {
        await result.current.handleCredentialBackup()
      })

      expect(mockSave).not.toHaveBeenCalled()
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to save backup" }),
      )
    })

    it("saves with the identity pubkey and navigates to success on completion", async () => {
      mockSave.mockResolvedValue({ success: true })
      const { result } = renderHook(() => useBackupMethods())

      await act(async () => {
        await result.current.handleCredentialBackup()
      })

      expect(mockSave).toHaveBeenCalledWith("test-pubkey-1234", "youth indicate void")
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ type: "success", message: "Backup saved" }),
      )
      expect(mockCompleteBackup).toHaveBeenCalledWith({ method: "keychain" })
    })

    it("stays silent when the user cancels", async () => {
      mockSave.mockResolvedValue({ success: false, error: "user-cancelled" })
      const { result } = renderHook(() => useBackupMethods())

      await act(async () => {
        await result.current.handleCredentialBackup()
      })

      expect(mockToastShow).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(mockCompleteBackup).not.toHaveBeenCalled()
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
    it("navigates to the cloud backup screen on iOS", () => {
      Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" })
      const { result } = renderHook(() => useBackupMethods())

      act(() => {
        result.current.handleCloudBackup()
      })

      expect(mockNavigate).toHaveBeenCalledWith("selfCustodialCloudBackup")
    })

    it("navigates to the cloud backup screen on Android", () => {
      Object.defineProperty(Platform, "OS", { configurable: true, value: "android" })
      const { result } = renderHook(() => useBackupMethods())

      act(() => {
        result.current.handleCloudBackup()
      })

      expect(mockNavigate).toHaveBeenCalledWith("selfCustodialCloudBackup")
    })
  })

  describe("handleManualBackup", () => {
    it("navigates to the alerts screen", () => {
      const { result } = renderHook(() => useBackupMethods())

      act(() => {
        result.current.handleManualBackup()
      })

      expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSecurityChecks")
    })
  })

  describe("isCredentialBackupAvailable (iOS multi-account gate)", () => {
    it("is true on Android regardless of how many self-custodial accounts exist", () => {
      Object.defineProperty(Platform, "OS", { configurable: true, value: "android" })
      mockSelfCustodialEntries = [
        { id: "self-custodial-1", lightningAddress: null },
        { id: "self-custodial-2", lightningAddress: null },
        { id: "self-custodial-3", lightningAddress: null },
      ]

      const { result } = renderHook(() => useBackupMethods())

      expect(result.current.isCredentialBackupAvailable).toBe(true)
    })

    it("is true on iOS when this is the only self-custodial account in the registry", () => {
      Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" })
      mockSelfCustodialEntries = [{ id: "self-custodial-1", lightningAddress: null }]

      const { result } = renderHook(() => useBackupMethods())

      expect(result.current.isCredentialBackupAvailable).toBe(true)
    })

    it("is true on iOS when the registry is empty (defensive — pre-add window)", () => {
      Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" })
      mockSelfCustodialEntries = []

      const { result } = renderHook(() => useBackupMethods())

      expect(result.current.isCredentialBackupAvailable).toBe(true)
    })

    it("is false on iOS when 2+ self-custodial accounts exist (multi-account Keychain bug guard)", () => {
      Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" })
      mockSelfCustodialEntries = [
        { id: "self-custodial-1", lightningAddress: null },
        { id: "self-custodial-2", lightningAddress: null },
      ]

      const { result } = renderHook(() => useBackupMethods())

      expect(result.current.isCredentialBackupAvailable).toBe(false)
    })
  })
})
