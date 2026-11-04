import React from "react"
import { Platform, Share } from "react-native"
import { act, renderHook } from "@testing-library/react-native"

import TypesafeI18n from "@app/i18n/i18n-react"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { useSetupKeyBackup } from "@app/screens/totp-screen/hooks/use-setup-key-backup"

loadLocale("en")
const LL = i18nObject("en")

/** Without spaces, as the setup key's screen takes it in. */
const SECRET = "ABCDEFGHIJKL"

let mockMe: { id: string; username: string | null } | undefined = {
  id: "user-id",
  username: "someone",
}
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useTotpRegistrationScreenQuery: () => ({ data: mockMe ? { me: mockMe } : undefined }),
}))

let mockGaloyInstance = { id: "Main", name: "Blink" }
jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({ appConfig: { galoyInstance: mockGaloyInstance } }),
}))

const mockLogBackupOption = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logSetupKeyBackupOptionSelected: (...args: unknown[]) => mockLogBackupOption(...args),
}))

const mockSavePasswordCredential = jest.fn()
jest.mock("@app/utils/credential-manager", () => ({
  ...jest.requireActual("@app/utils/credential-manager"),
  savePasswordCredential: (...args: unknown[]) => mockSavePasswordCredential(...args),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TypesafeI18n locale="en">{children}</TypesafeI18n>
)

const renderBackup = (secret = SECRET) =>
  renderHook(() => useSetupKeyBackup({ secret, userId: "user-id" }), { wrapper })

const saveWith = async (secret?: string) => {
  const { result } = renderBackup(secret)
  await act(() => result.current.saveToPasswordManager())
}

/** The toast's message, as the hook shows it. */
const toastMessage = () => mockToastShow.mock.calls.at(-1)?.[0]?.message

// eslint-disable-next-line max-lines-per-function -- one hook's suite, sharing the mocked save and toast above
describe("useSetupKeyBackup", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMe = { id: "user-id", username: "someone" }
    mockGaloyInstance = { id: "Main", name: "Blink" }
    jest.replaceProperty(Platform, "OS", "android")
    mockSavePasswordCredential.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  /** The password manager the user has answers the system sheet, as it does for the
   *  self-custodial backup. */
  it("says the system's save sheet takes the key on Android", () => {
    const { result } = renderBackup()

    expect(result.current.canRaiseSaveSheet).toBe(true)
  })

  it("saves the key as a password named after its account, and says so", async () => {
    await saveWith()

    expect(mockSavePasswordCredential).toHaveBeenCalledWith("someone (2FA)", SECRET)
    expect(mockLogBackupOption).toHaveBeenCalledWith({ option: "password_manager" })
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: LL.BackupScreen.BackupMethod.passwordManagerBackupSaved(),
        type: "success",
      }),
    )
    expect(mockReportError).not.toHaveBeenCalled()
  })

  /** As an authenticator takes it in, and as the manual copy gives it. */
  it("saves the key without the spaces it is shown with", async () => {
    await saveWith("ABCD EFGH IJKL")

    expect(mockSavePasswordCredential).toHaveBeenCalledWith(
      "someone (2FA)",
      "ABCDEFGHIJKL",
    )
  })

  it("names the account by its user id while it has no username", async () => {
    mockMe = { id: "user-id", username: null }

    await saveWith()

    expect(mockSavePasswordCredential).toHaveBeenCalledWith("user-id (2FA)", SECRET)
  })

  /** A staging account's key is never taken for the production account's. */
  it("names the instance the account is on outside production", async () => {
    mockGaloyInstance = { id: "Staging", name: "Staging" }

    await saveWith()

    expect(mockSavePasswordCredential).toHaveBeenCalledWith(
      "Staging: someone (2FA)",
      SECRET,
    )
  })

  /** The user id comes with the accepted code, so the account never goes unnamed. */
  it("names the account by the user id while the username is not in the cache", async () => {
    mockMe = undefined

    await saveWith()

    expect(mockSavePasswordCredential).toHaveBeenCalledWith("user-id (2FA)", SECRET)
  })

  it("says nothing when the user declines the sheet", async () => {
    mockSavePasswordCredential.mockResolvedValue({
      success: false,
      error: "user-cancelled",
    })

    await saveWith()

    expect(mockToastShow).not.toHaveBeenCalled()
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it("says there is no password manager, and to copy the key instead", async () => {
    mockSavePasswordCredential.mockResolvedValue({ success: false, error: "no-provider" })

    await saveWith()

    expect(toastMessage()).toBe(LL.AuthenticatorOnboarding.passwordManagerUnavailable())
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it("says the same where saving is unsupported", async () => {
    mockSavePasswordCredential.mockResolvedValue({ success: false, error: "unsupported" })

    await saveWith()

    expect(toastMessage()).toBe(LL.AuthenticatorOnboarding.passwordManagerUnavailable())
  })

  it("reports a save that fails, with its cause, and says it failed", async () => {
    const failure = new Error("Something broke")
    mockSavePasswordCredential.mockResolvedValue({
      success: false,
      error: "unknown",
      cause: failure,
    })

    await saveWith()

    expect(mockReportError).toHaveBeenCalledWith(
      "Setup key password manager save",
      failure,
    )
    expect(toastMessage()).toBe(
      LL.BackupScreen.BackupMethod.passwordManagerBackupFailed(),
    )
  })

  it("reports the failure itself when the save hands back no cause", async () => {
    mockSavePasswordCredential.mockResolvedValue({ success: false, error: "unknown" })

    await saveWith()

    expect(mockReportError).toHaveBeenCalledWith(
      "Setup key password manager save",
      "unknown",
    )
  })

  /** A credential error added without its message fails loudly rather than say
   *  nothing. */
  it("throws on a credential error it does not know", async () => {
    mockSavePasswordCredential.mockResolvedValue({ success: false, error: "bogus" })
    const { result } = renderBackup()

    await expect(result.current.saveToPasswordManager()).rejects.toThrow(
      "Unknown credential error: bogus",
    )
  })

  it("raises one sheet when tapped twice in a row", async () => {
    let finish: (value: unknown) => void = () => {}
    mockSavePasswordCredential.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const { result } = renderBackup()

    await act(async () => {
      result.current.saveToPasswordManager()
      result.current.saveToPasswordManager()
    })
    await act(async () => finish({ success: true }))

    expect(mockSavePasswordCredential).toHaveBeenCalledTimes(1)
  })

  /** iOS has no API that raises its save sheet: the user picks their password manager
   *  from the share sheet instead. */
  describe("on iOS", () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, "OS", "ios")
    })

    it("says the system's save sheet cannot take the key", () => {
      const { result } = renderBackup()

      expect(result.current.canRaiseSaveSheet).toBe(false)
    })

    it("hands the key, with its account, to the share sheet", async () => {
      const share = jest
        .spyOn(Share, "share")
        .mockResolvedValue({ action: "sharedAction" })

      await saveWith("ABCD EFGH IJKL")

      expect(share).toHaveBeenCalledWith({
        message: LL.AuthenticatorOnboarding.keyBackupText({
          account: "someone",
          key: "ABCDEFGHIJKL",
        }),
      })
      expect(mockSavePasswordCredential).not.toHaveBeenCalled()
      expect(mockLogBackupOption).toHaveBeenCalledWith({ option: "password_manager" })
      expect(mockToastShow).not.toHaveBeenCalled()
    })

    it("reports a share sheet that fails to open", async () => {
      const failure = new Error("no activity")
      jest.spyOn(Share, "share").mockRejectedValue(failure)

      await saveWith()

      expect(mockReportError).toHaveBeenCalledWith("Setup key share", failure)
    })
  })

  it("reports a manual copy as the option used, and nothing more", () => {
    const { result } = renderBackup()

    act(() => result.current.reportManualCopy())

    expect(mockLogBackupOption).toHaveBeenCalledWith({ option: "manual_copy" })
  })
})
