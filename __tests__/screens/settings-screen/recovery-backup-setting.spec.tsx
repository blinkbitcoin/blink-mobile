import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import type { TranslationFunctions } from "@app/i18n/i18n-types"
import { RecoveryBackupSetting } from "@app/screens/settings-screen/settings/recovery-backup"
import { RecoveryBundleStatus } from "@app/self-custodial/hooks/use-recovery-bundle-status"
import { AccountType } from "@app/types/wallet"

let LL: TranslationFunctions

const mockNavigate = jest.fn()
const mockAccount = jest.fn()
const mockStatus = jest.fn()

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

jest.mock("@app/self-custodial/hooks/use-recovery-bundle-status", () => ({
  ...jest.requireActual("@app/self-custodial/hooks/use-recovery-bundle-status"),
  useRecoveryBundleStatus: () => mockStatus(),
}))

const renderRow = () =>
  render(
    <ThemeProvider theme={theme}>
      <RecoveryBackupSetting />
    </ThemeProvider>,
  )

const withStatus = (status: RecoveryBundleStatus) =>
  mockStatus.mockReturnValue({
    status,
    savedAt: null,
    leafCount: null,
    isOnlyOnThisDevice: false,
    reload: jest.fn(),
  })

describe("RecoveryBackupSetting", () => {
  beforeAll(() => {
    loadLocale("en")
    LL = i18nObject("en")
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockAccount.mockReturnValue({ id: "a1", type: AccountType.SelfCustodial })
    withStatus(RecoveryBundleStatus.Fresh)
  })

  it("is hidden on a custodial account", () => {
    // Custodial accounts have no bundle at all; the row would be meaningless.
    mockAccount.mockReturnValue({ id: "c1", type: AccountType.Custodial })
    const { queryByText } = renderRow()

    expect(queryByText(LL.RecoveryBundleScreen.settingsTitle())).toBeNull()
  })

  it("opens the recovery backup screen", () => {
    const { getByText } = renderRow()

    fireEvent.press(getByText(LL.RecoveryBundleScreen.settingsTitle()))
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialRecoveryBackup")
  })

  describe("status chip", () => {
    it("reads Backed up when the bundle matches the wallet", () => {
      withStatus(RecoveryBundleStatus.Fresh)
      const { getByText } = renderRow()

      expect(getByText(LL.RecoveryBundleScreen.chipFresh())).toBeTruthy()
    })

    it("reads Out of date once the wallet has moved on", () => {
      withStatus(RecoveryBundleStatus.Stale)
      const { getByText } = renderRow()

      expect(getByText(LL.RecoveryBundleScreen.chipStale())).toBeTruthy()
    })

    it("reads Not set up when no bundle exists", () => {
      withStatus(RecoveryBundleStatus.Missing)
      const { getByText } = renderRow()

      expect(getByText(LL.RecoveryBundleScreen.chipMissing())).toBeTruthy()
    })

    it("shows no chip until the first read lands", () => {
      // Guessing here would flash the wrong state on every visit to Settings.
      withStatus(RecoveryBundleStatus.Unknown)
      const { queryByTestId, getByText } = renderRow()

      expect(queryByTestId("recovery-backup-chip")).toBeNull()
      expect(getByText(LL.RecoveryBundleScreen.settingsTitle())).toBeTruthy()
    })
  })
})
