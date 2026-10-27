import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import type { TranslationFunctions } from "@app/i18n/i18n-types"
import { EmergencyBundleSetting } from "@app/screens/settings-screen/settings/emergency-bundle"
import { BackupStatus } from "@app/self-custodial/providers/backup-state"
import { AccountType } from "@app/types/wallet"

let LL: TranslationFunctions

const mockNavigate = jest.fn()
const mockAccount = jest.fn()
const mockBackupStatus = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}))

// Real strings rather than stubs, so the assertions below check the copy the
// user actually sees.
jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: jest
      .requireActual<typeof import("@app/i18n/i18n-util")>("@app/i18n/i18n-util")
      .i18nObject("en"),
  }),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockAccount() }),
}))

jest.mock("@app/self-custodial/providers/backup-state", () => ({
  ...jest.requireActual("@app/self-custodial/providers/backup-state"),
  useBackupState: () => ({ backupState: { status: mockBackupStatus() } }),
}))

const renderRow = () =>
  render(
    <ThemeProvider theme={theme}>
      <EmergencyBundleSetting />
    </ThemeProvider>,
  )

describe("EmergencyBundleSetting", () => {
  beforeAll(() => {
    loadLocale("en")
    LL = i18nObject("en")
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockAccount.mockReturnValue({ id: "a1", type: AccountType.SelfCustodial })
    mockBackupStatus.mockReturnValue(BackupStatus.Completed)
  })

  /** The row must render nothing at all when hidden - not an empty wrapper -
   *  or SettingsGroup draws a phantom row and divider. */
  it("renders nothing on a custodial account", () => {
    mockAccount.mockReturnValue({ id: "c1", type: AccountType.Custodial })

    expect(renderRow().toJSON()).toBeNull()
  })

  it("renders nothing before the backup is completed", () => {
    mockBackupStatus.mockReturnValue(BackupStatus.None)

    expect(renderRow().toJSON()).toBeNull()
  })

  it("shows Emergency bundle once a self-custodial backup is completed", () => {
    const { getByText } = renderRow()

    expect(getByText(LL.BackupScreen.BundleExport.title())).toBeTruthy()
  })

  it("opens the emergency bundle screen from the settings entry", () => {
    const { getByText } = renderRow()

    fireEvent.press(getByText(LL.BackupScreen.BundleExport.title()))
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupBundleExport")
  })
})
