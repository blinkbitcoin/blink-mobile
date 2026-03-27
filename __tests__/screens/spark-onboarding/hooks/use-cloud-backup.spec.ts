import { renderHook, act } from "@testing-library/react-native"
import { Alert } from "react-native"

import { useCloudBackup } from "@app/screens/spark-onboarding/hooks/use-cloud-backup"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: jest.fn(),
}))

const mockStartSession = jest.fn()
const mockUpload = jest.fn()
let mockLoading = false

jest.mock("@app/hooks", () => ({
  useGoogleDriveBackup: () => ({
    startSession: mockStartSession,
    upload: mockUpload,
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

jest.mock("@app/utils/crypto", () => ({
  deriveKeyFromPassword: () => ({
    key: "abcd1234abcd1234abcd1234abcd1234",
    salt: "c2FsdA==",
  }),
  encryptAesGcm: () => ({ data: "ZW5jcnlwdGVk", iv: "aXY=" }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: { cancel: () => "Cancel" },
      SparkOnboarding: {
        BackupMethod: {
          googleDrive: () => "Google Drive",
          appleICloud: () => "Apple iCloud",
        },
        CloudBackup: {
          uploadSuccess: ({ provider }: { provider: string }) => `Saved to ${provider}`,
          uploadFailed: () => "Upload failed",
          existingBackupTitle: () => "Backup found",
          existingBackupMessage: () => "Overwrite?",
          overwrite: () => "Overwrite",
        },
      },
    },
  }),
}))

const noExistingFile = { accessToken: "token", existingFileId: undefined }
const withExistingFile = { accessToken: "token", existingFileId: "file-123" }

describe("useCloudBackup", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLoading = false
    mockStartSession.mockResolvedValue(noExistingFile)
  })

  it("uploads unencrypted backup and navigates to success", async () => {
    mockUpload.mockResolvedValue({ success: true })

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockStartSession).toHaveBeenCalledWith("blink-spark-backup-blink.json")
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining('"encrypted":false'),
      "blink-spark-backup-blink.json",
      noExistingFile,
    )
    expect(mockNavigate).toHaveBeenCalledWith("sparkBackupSuccessScreen")
  })

  it("uploads encrypted backup when encryption enabled", async () => {
    mockUpload.mockResolvedValue({ success: true })

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: true, password: "mypassword123" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining('"encrypted":true'),
      "blink-spark-backup-blink.json",
      noExistingFile,
    )
    expect(mockNavigate).toHaveBeenCalledWith("sparkBackupSuccessScreen")
  })

  it("shows error toast on upload failure", async () => {
    mockUpload.mockResolvedValue({ success: false, error: "403: Forbidden" })

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "403: Forbidden" }),
    )
    expect(mockNavigate).not.toHaveBeenCalledWith("sparkBackupSuccessScreen")
  })

  it("shows error toast on sign-in failure", async () => {
    mockStartSession.mockRejectedValue(new Error("DEVELOPER_ERROR"))

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "DEVELOPER_ERROR" }),
    )
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it("shows overwrite confirmation when backup exists", async () => {
    mockStartSession.mockResolvedValue(withExistingFile)
    mockUpload.mockResolvedValue({ success: true })

    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_, __, buttons) => {
      const overwriteBtn = buttons?.find((b) => b.style === "destructive")
      overwriteBtn?.onPress?.()
    })

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(alertSpy).toHaveBeenCalledWith("Backup found", "Overwrite?", expect.any(Array))
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining('"encrypted":false'),
      "blink-spark-backup-blink.json",
      withExistingFile,
    )

    alertSpy.mockRestore()
  })

  it("does not upload when user cancels overwrite", async () => {
    mockStartSession.mockResolvedValue(withExistingFile)

    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_, __, buttons) => {
      const cancelBtn = buttons?.find((b) => b.style === "cancel")
      cancelBtn?.onPress?.()
    })

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()

    alertSpy.mockRestore()
  })

  it("includes version in backup payload", async () => {
    mockUpload.mockResolvedValue({ success: true })

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining('"version":1'),
      expect.stringContaining("blink-spark-backup"),
      noExistingFile,
    )
  })
})
