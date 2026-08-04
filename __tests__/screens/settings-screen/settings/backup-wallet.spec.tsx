import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { BackupWalletSetting } from "@app/screens/settings-screen/settings/backup-wallet"
import { AccountType } from "@app/types/wallet"

const mockActiveAccount = jest.fn()
const mockBackupState = jest.fn()
const mockNavigate = jest.fn()

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount() }),
}))

jest.mock("@app/self-custodial/providers/backup-state", () => ({
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
        title: () => "Back up your wallet",
      },
    },
  }),
}))

jest.mock("@app/screens/settings-screen/row", () => ({
  SettingsRow: ({ title, action }: { title: string; action?: () => void }) =>
    React.createElement("Text", { testID: "settings-row", onPress: action }, title),
}))

describe("BackupWalletSetting", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders when self-custodial and backup completed", () => {
    mockActiveAccount.mockReturnValue({
      type: AccountType.SelfCustodial,
    })
    mockBackupState.mockReturnValue({ status: "completed" })

    const { getByTestId } = render(<BackupWalletSetting />)

    expect(getByTestId("settings-row")).toBeTruthy()
  })

  it("re-opens the backup method picker on press — the missing door of #3828", () => {
    mockActiveAccount.mockReturnValue({
      type: AccountType.SelfCustodial,
    })
    mockBackupState.mockReturnValue({ status: "completed" })

    const { getByTestId } = render(<BackupWalletSetting />)
    fireEvent.press(getByTestId("settings-row"))

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupMethod")
  })

  it("returns null when custodial account", () => {
    mockActiveAccount.mockReturnValue({
      type: AccountType.Custodial,
    })
    mockBackupState.mockReturnValue({ status: "completed" })

    const { queryByTestId } = render(<BackupWalletSetting />)

    expect(queryByTestId("settings-row")).toBeNull()
  })

  it("returns null before first completion — the warning banner is the entry point then", () => {
    mockActiveAccount.mockReturnValue({
      type: AccountType.SelfCustodial,
    })
    mockBackupState.mockReturnValue({ status: "none" })

    const { queryByTestId } = render(<BackupWalletSetting />)

    expect(queryByTestId("settings-row")).toBeNull()
  })

  it("returns null when no active account", () => {
    mockActiveAccount.mockReturnValue(undefined)
    mockBackupState.mockReturnValue({ status: "completed" })

    const { queryByTestId } = render(<BackupWalletSetting />)

    expect(queryByTestId("settings-row")).toBeNull()
  })
})
