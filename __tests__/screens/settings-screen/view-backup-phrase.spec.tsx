import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { ViewBackupPhraseSetting } from "@app/screens/settings-screen/settings/view-backup-phrase"
import { AccountType } from "@app/types/wallet.types"

const mockActiveAccount = jest.fn()
const mockBackupState = jest.fn()
const mockNavigate = jest.fn()

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount() }),
}))

jest.mock("@app/self-custodial/providers/backup-state-provider", () => ({
  BackupStatus: { None: "none", Completed: "completed" },
  useBackupState: () => ({ backupState: mockBackupState() }),
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      BackupScreen: {
        ManualBackup: {
          Phrase: { headerTitle: () => "View phrase" },
        },
      },
    },
  }),
}))

jest.mock("@app/screens/settings-screen/row", () => ({
  SettingsRow: ({ title, action }: { title: string; action?: () => void }) =>
    React.createElement("Text", { testID: "settings-row", onPress: action }, title),
}))

describe("ViewBackupPhraseSetting", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders when self-custodial and backup completed", () => {
    mockActiveAccount.mockReturnValue({
      type: AccountType.SelfCustodial,
    })
    mockBackupState.mockReturnValue({ status: "completed" })

    const { getByTestId } = render(<ViewBackupPhraseSetting />)

    expect(getByTestId("settings-row")).toBeTruthy()
  })

  it("navigates to the view-backup-alerts screen on press — the phrase is gated behind the 3-checks confirmation", () => {
    mockActiveAccount.mockReturnValue({
      type: AccountType.SelfCustodial,
    })
    mockBackupState.mockReturnValue({ status: "completed" })

    const { getByTestId } = render(<ViewBackupPhraseSetting />)
    fireEvent.press(getByTestId("settings-row"))

    expect(mockNavigate).toHaveBeenCalledWith("sparkViewBackupAlertsScreen")
  })

  it("never bypasses the alerts gate — pressing the row must not jump straight to the phrase screen", () => {
    mockActiveAccount.mockReturnValue({
      type: AccountType.SelfCustodial,
    })
    mockBackupState.mockReturnValue({ status: "completed" })

    const { getByTestId } = render(<ViewBackupPhraseSetting />)
    fireEvent.press(getByTestId("settings-row"))

    expect(mockNavigate).not.toHaveBeenCalledWith("sparkViewBackupPhraseScreen")
  })

  it("returns null when custodial account", () => {
    mockActiveAccount.mockReturnValue({
      type: AccountType.Custodial,
    })
    mockBackupState.mockReturnValue({ status: "completed" })

    const { queryByTestId } = render(<ViewBackupPhraseSetting />)

    expect(queryByTestId("settings-row")).toBeNull()
  })

  it("returns null when backup not completed", () => {
    mockActiveAccount.mockReturnValue({
      type: AccountType.SelfCustodial,
    })
    mockBackupState.mockReturnValue({ status: "none" })

    const { queryByTestId } = render(<ViewBackupPhraseSetting />)

    expect(queryByTestId("settings-row")).toBeNull()
  })

  it("returns null when no active account", () => {
    mockActiveAccount.mockReturnValue(undefined)
    mockBackupState.mockReturnValue({ status: "completed" })

    const { queryByTestId } = render(<ViewBackupPhraseSetting />)

    expect(queryByTestId("settings-row")).toBeNull()
  })
})
