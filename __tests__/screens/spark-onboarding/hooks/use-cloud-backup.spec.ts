import { renderHook, act } from "@testing-library/react-native"

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

jest.mock("@app/hooks/use-wallet-mnemonic", () => ({
  useWalletMnemonic: () => "youth indicate void",
}))

jest.mock("@app/self-custodial/providers/backup-state-provider", () => ({
  useBackupState: () => ({
    setBackupCompleted: jest.fn(),
  }),
}))

jest.mock("@app/utils/spark-backup-format", () => ({
  buildBackupPayload: jest.fn(
    (_mnemonic: string, opts: { password?: string; version?: number }) =>
      JSON.stringify({
        version: opts.version ?? 1,
        encrypted: Boolean(opts.password),
        mnemonic: opts.password ? "ZW5jcnlwdGVk" : "youth indicate void",
      }),
  ),
}))

const mockConfirmDialog = jest.fn()
jest.mock("@app/utils/confirm-dialog", () => ({
  confirmDialog: (...args: readonly unknown[]) => mockConfirmDialog(...args),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: { cancel: () => "Cancel" },
      BackupScreen: {
        BackupMethod: {
          googleDrive: () => "Google Drive",
          appleICloud: () => "Apple iCloud",
        },
        CloudBackup: {
          uploadSuccess: ({ provider }: { provider: string }) => `Saved to ${provider}`,
          uploadFailed: () => "Upload failed",
          signInFailed: () => "Sign in failed",
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
      expect.objectContaining({ message: "Upload failed" }),
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
      expect.objectContaining({ message: "Sign in failed" }),
    )
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it("shows overwrite confirmation when backup exists", async () => {
    mockStartSession.mockResolvedValue(withExistingFile)
    mockUpload.mockResolvedValue({ success: true })
    mockConfirmDialog.mockResolvedValue(true)

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Backup found",
        labels: expect.objectContaining({ confirm: "Overwrite" }),
      }),
    )
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining('"encrypted":false'),
      "blink-spark-backup-blink.json",
      withExistingFile,
    )
  })

  it("does not upload when user cancels overwrite", async () => {
    mockStartSession.mockResolvedValue(withExistingFile)
    mockConfirmDialog.mockResolvedValue(false)

    const { result } = renderHook(() =>
      useCloudBackup({ isEncrypted: false, password: "" }),
    )

    await act(async () => {
      await result.current.handleBackup()
    })

    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
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
