import React from "react"
import { Share } from "react-native"
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

const mockLogBackupOption = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logSetupKeyBackupOptionSelected: (...args: unknown[]) => mockLogBackupOption(...args),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TypesafeI18n locale="en">{children}</TypesafeI18n>
)

const renderBackup = () =>
  renderHook(() => useSetupKeyBackup({ secret: SECRET, userId: "user-id" }), { wrapper })

const backupTextFor = (account: string) =>
  LL.AuthenticatorOnboarding.keyBackupText({ account, key: SECRET })

describe("useSetupKeyBackup", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMe = { id: "user-id", username: "someone" }
  })

  /** The text names the account, so the saved entry says which one it is for. */
  it("hands the key, with its account, to the share sheet for a password manager", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" })
    const { result } = renderBackup()

    await act(() => result.current.saveToPasswordManager())

    expect(share).toHaveBeenCalledWith({ message: backupTextFor("someone") })
    expect(mockLogBackupOption).toHaveBeenCalledWith({ option: "password_manager" })
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it("names the account by its user id while it has no username", async () => {
    mockMe = { id: "user-id", username: null }
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" })
    const { result } = renderBackup()

    await act(() => result.current.saveToPasswordManager())

    expect(share).toHaveBeenCalledWith({ message: backupTextFor("user-id") })
  })

  /** The user id comes with the accepted code, so the account never goes unnamed. */
  it("names the account by the user id while the username is not in the cache", async () => {
    mockMe = undefined
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" })
    const { result } = renderBackup()

    await act(() => result.current.saveToPasswordManager())

    expect(share).toHaveBeenCalledWith({ message: backupTextFor("user-id") })
  })

  it("reports a share sheet that fails to open", async () => {
    const failure = new Error("no activity")
    jest.spyOn(Share, "share").mockRejectedValue(failure)
    const { result } = renderBackup()

    await act(() => result.current.saveToPasswordManager())

    expect(mockReportError).toHaveBeenCalledWith("Setup key share", failure)
  })

  it("reports a manual copy as the option used, and nothing more", () => {
    const { result } = renderBackup()

    act(() => result.current.reportManualCopy())

    expect(mockLogBackupOption).toHaveBeenCalledWith({ option: "manual_copy" })
  })
})
