import { renderHook, act } from "@testing-library/react-native"
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
  useKeychainBackup: () => ({
    save: mockSave,
    loading: mockLoading,
  }),
  useAppConfig: () => ({
    appConfig: { galoyInstance: { name: "Blink" } },
  }),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

jest.mock("@app/hooks/use-wallet-mnemonic", () => ({
  useWalletMnemonic: () => "youth indicate void",
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      SparkOnboarding: {
        BackupMethod: {
          keychainSaved: () => "Backup saved",
          keychainFailed: () => "Failed to save backup",
          iOSComingSoon: () => "Coming soon on iOS",
        },
      },
    },
  }),
}))

describe("useBackupMethods", () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    jest.clearAllMocks()
    mockLoading = false
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform })
  })

  afterAll(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform })
  })

  it("returns keychain loading state", () => {
    mockLoading = true
    const { result } = renderHook(() => useBackupMethods())
    expect(result.current.keychainLoading).toBe(true)
    expect(result.current.isCloudBackupAvailable).toBe(originalPlatform !== "ios")
  })

  it("saves to keychain and navigates to success on handleKeychainBackup", async () => {
    mockSave.mockResolvedValue(true)
    const { result } = renderHook(() => useBackupMethods())

    await act(async () => {
      await result.current.handleKeychainBackup()
    })

    expect(mockSave).toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    )
    expect(mockNavigate).toHaveBeenCalledWith("sparkBackupSuccessScreen")
  })

  it("does not navigate on keychain save failure", async () => {
    mockSave.mockResolvedValue(false)
    const { result } = renderHook(() => useBackupMethods())

    await act(async () => {
      await result.current.handleKeychainBackup()
    })

    expect(mockSave).toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Failed to save backup" }),
    )
    expect(mockNavigate).not.toHaveBeenCalledWith("sparkBackupSuccessScreen")
  })

  it("does not navigate on handleCloudBackup on iOS", () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" })

    const { result } = renderHook(() => useBackupMethods())

    act(() => {
      result.current.handleCloudBackup()
    })

    expect(result.current.isCloudBackupAvailable).toBe(false)
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Coming soon on iOS" }),
    )
    expect(mockNavigate).not.toHaveBeenCalledWith("sparkCloudBackupScreen")
  })

  it("navigates on handleCloudBackup when platform is not iOS", () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" })

    const { result } = renderHook(() => useBackupMethods())

    act(() => {
      result.current.handleCloudBackup()
    })

    expect(result.current.isCloudBackupAvailable).toBe(true)
    expect(mockNavigate).toHaveBeenCalledWith("sparkCloudBackupScreen")
  })

  it("navigates to alerts screen on handleManualBackup", () => {
    const { result } = renderHook(() => useBackupMethods())

    act(() => {
      result.current.handleManualBackup()
    })

    expect(mockNavigate).toHaveBeenCalledWith("sparkBackupAlertsScreen")
  })
})
