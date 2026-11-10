import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import type { TranslationFunctions } from "@app/i18n/i18n-types"
import { EmergencyBundleSetting } from "@app/screens/settings-screen/settings/emergency-bundle"
import { AccountType } from "@app/types/wallet"

let LL: TranslationFunctions

const mockNavigate = jest.fn()
const mockAccount = jest.fn()

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

/** No backup yet: the row must not depend on one. */
jest.mock("@app/self-custodial/providers/backup-state", () => {
  const actual = jest.requireActual("@app/self-custodial/providers/backup-state")
  return {
    ...actual,
    useBackupState: () => ({
      backupState: { status: actual.BackupStatus.None, method: null },
    }),
  }
})

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
  })

  /** The row must render nothing at all when hidden - not an empty wrapper -
   *  or SettingsGroup draws a phantom row and divider. */
  it("renders nothing on a custodial account", () => {
    mockAccount.mockReturnValue({ id: "c1", type: AccountType.Custodial })

    expect(renderRow().toJSON()).toBeNull()
  })

  /** The bundle lives on the device whether or not the seed is backed up, so
   *  the row does not wait for a backup. */
  it("shows Emergency exit on a self-custodial account with no backup yet", () => {
    const { getByText } = renderRow()

    expect(getByText(LL.BackupScreen.BundleExport.title())).toBeTruthy()
  })

  /** The row carries the name of the screen it opens. */
  it("is named Emergency exit, like the screen", () => {
    expect(LL.BackupScreen.BundleExport.title()).toBe("Emergency exit")
  })

  it("opens the emergency exit screen from the settings entry", () => {
    const { getByText } = renderRow()

    fireEvent.press(getByText(LL.BackupScreen.BundleExport.title()))
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupBundleExport")
  })
})
