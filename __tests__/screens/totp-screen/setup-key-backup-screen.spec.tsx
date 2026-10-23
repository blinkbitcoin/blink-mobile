import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { SetupKeyBackupScreen } from "@app/screens/totp-screen"
import { ContactField } from "@app/types/two-factor-enforcement"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const SECRET = "ABCD EFGH IJKL"

const mockReplace = jest.fn()
let mockRouteParams: Record<string, unknown> = {}
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ replace: mockReplace }),
  useRoute: () => ({ params: mockRouteParams }),
}))

const mockEnableScreenSecurity = jest.fn()
jest.mock("@app/utils/screen-security", () => ({
  enableScreenSecurity: (...args: unknown[]) => {
    mockEnableScreenSecurity(...args)
    return Promise.resolve()
  },
  disableScreenSecurity: () => Promise.resolve(),
}))

const mockUseHardwareBackGuard = jest.fn()
jest.mock("@app/screens/account-migration/hooks/use-hardware-back-guard", () => ({
  useHardwareBackGuard: (onBack?: () => void) => mockUseHardwareBackGuard(onBack),
}))

const mockCopyToClipboard = jest.fn()
jest.mock("@app/hooks", () => ({
  ...jest.requireActual("@app/hooks"),
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

const mockSaveToPasswordManager = jest.fn()
const mockReportManualCopy = jest.fn()
const mockBackup = {
  saveToPasswordManager: mockSaveToPasswordManager,
  reportManualCopy: mockReportManualCopy,
}
const mockUseSetupKeyBackup = jest.fn()
jest.mock("@app/screens/totp-screen/hooks/use-setup-key-backup", () => ({
  useSetupKeyBackup: (params: unknown) => {
    mockUseSetupKeyBackup(params)
    return mockBackup
  },
}))

const renderScreen = async () => {
  render(
    <ContextForScreen>
      <SetupKeyBackupScreen />
    </ContextForScreen>,
  )
  await flushEffects()
}

describe("SetupKeyBackupScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockRouteParams = { secret: SECRET, userId: "user-id" }
  })

  it("asks to keep the key off this phone, with every way to do it", async () => {
    await renderScreen()

    expect(screen.getByText(LL.AuthenticatorOnboarding.backupTitle())).toBeTruthy()
    expect(screen.getByText(LL.AuthenticatorOnboarding.backupDescription())).toBeTruthy()
    expect(
      screen.getByText(LL.AuthenticatorOnboarding.saveToPasswordManager()),
    ).toBeTruthy()
    expect(
      screen.getByText(LL.AuthenticatorOnboarding.copyForManualBackup()),
    ).toBeTruthy()
    expect(screen.getByText(SECRET)).toBeTruthy()
    expect(mockUseSetupKeyBackup).toHaveBeenCalledWith({
      secret: SECRET,
      userId: "user-id",
    })
  })

  it("keeps the key out of screenshots, recordings and the app switcher", async () => {
    await renderScreen()

    expect(mockEnableScreenSecurity).toHaveBeenCalledTimes(1)
  })

  /** The guard with no handler swallows the system back, edge swipes included; what
   *  the press does on a real stack is pinned in the setup's stack spec. */
  it("swallows the system back, the one chance to keep the key", async () => {
    await renderScreen()

    expect(mockUseHardwareBackGuard).toHaveBeenCalledWith(undefined)
  })

  it("hands the key to a password manager from its row", async () => {
    await renderScreen()

    fireEvent.press(screen.getByText(LL.AuthenticatorOnboarding.saveToPasswordManager()))

    expect(mockSaveToPasswordManager).toHaveBeenCalledTimes(1)
  })

  it("copies the key for a manual backup and reports it", async () => {
    await renderScreen()

    fireEvent.press(screen.getByTestId("setup-key-copy"))

    expect(mockCopyToClipboard).toHaveBeenCalledWith(
      expect.objectContaining({ content: "ABCDEFGHIJKL" }),
    )
    expect(mockReportManualCopy).toHaveBeenCalledTimes(1)
  })

  /** In its place, so no way back from the done screen shows the key again. */
  it("puts the done screen in its place from I've saved it, whether or not an option was used", async () => {
    await renderScreen()

    fireEvent.press(screen.getByText(LL.AuthenticatorOnboarding.savedIt()))

    expect(mockReplace).toHaveBeenCalledWith("totpRegistrationDone", {
      contactChange: undefined,
    })
  })

  it("tells the done screen which login method change the authenticator was added for", async () => {
    mockRouteParams = {
      secret: SECRET,
      userId: "user-id",
      contactChange: ContactField.Phone,
    }
    await renderScreen()

    fireEvent.press(screen.getByText(LL.AuthenticatorOnboarding.savedIt()))

    expect(mockReplace).toHaveBeenCalledWith("totpRegistrationDone", {
      contactChange: ContactField.Phone,
    })
  })
})
