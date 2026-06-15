import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { AccountFields } from "@app/screens/settings-screen/self-custodial/account-fields"
import theme from "@app/rne-theme/theme"

const mockAccountInfo = {
  identityPubkey: "abc-pubkey",
  lightningAddress: "user@blink.sv" as string | null,
  loading: false as boolean,
  error: null as Error | null,
}
const mockBackupStatus = { status: "completed" as "completed" | "not-completed" }
const mockCopyToClipboard = jest.fn()

jest.mock("@app/self-custodial/hooks/use-self-custodial-account-info", () => ({
  useSelfCustodialAccountInfo: () => mockAccountInfo,
}))

jest.mock("@app/self-custodial/providers/backup-state", () => ({
  BackupStatus: { Completed: "completed", NotCompleted: "not-completed" },
  useBackupState: () => ({ backupState: mockBackupStatus }),
}))

jest.mock("@app/hooks", () => ({
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      SettingsScreen: {
        AccountInformation: {
          identityLabel: () => "Wallet identifier",
          lightningAddressLabel: () => "Lightning address",
          backupStatusLabel: () => "Backup status",
          backupStatusCompleted: () => "Completed",
          backupStatusNotCompleted: () => "Not completed",
          loadError: () => "Could not load account info",
        },
      },
    },
  }),
}))

const renderFields = () =>
  render(
    <ThemeProvider theme={theme}>
      <AccountFields />
    </ThemeProvider>,
  )

describe("AccountFields", () => {
  beforeEach(() => {
    mockAccountInfo.identityPubkey = "abc-pubkey"
    mockAccountInfo.lightningAddress = "user@blink.sv"
    mockAccountInfo.loading = false
    mockAccountInfo.error = null
    mockBackupStatus.status = "completed"
    mockCopyToClipboard.mockClear()
  })

  it("hides the fields while account info is loading", () => {
    mockAccountInfo.loading = true
    const { queryByText } = renderFields()
    expect(queryByText("Wallet identifier")).toBeNull()
    expect(queryByText("Lightning address")).toBeNull()
    expect(queryByText("Could not load account info")).toBeNull()
  })

  it("renders the error message when account info fails to load", () => {
    mockAccountInfo.error = new Error("boom")
    const { getByText, getByTestId } = renderFields()
    expect(getByText("Could not load account info")).toBeTruthy()
    expect(getByTestId("account-info-error")).toBeTruthy()
  })

  it("renders identity, lightning address and backup-status fields when info is loaded", () => {
    const { getByText } = renderFields()
    expect(getByText("Wallet identifier")).toBeTruthy()
    expect(getByText("abc-pubkey")).toBeTruthy()
    expect(getByText("Lightning address")).toBeTruthy()
    expect(getByText("user@blink.sv")).toBeTruthy()
    expect(getByText("Completed")).toBeTruthy()
  })

  it("omits the lightning address field when there is no LN address", () => {
    mockAccountInfo.lightningAddress = null
    const { queryByText } = renderFields()
    expect(queryByText("Lightning address")).toBeNull()
  })

  it("maps backup-status `not-completed` to the localized label", () => {
    mockBackupStatus.status = "not-completed"
    const { getByText } = renderFields()
    expect(getByText("Not completed")).toBeTruthy()
  })

  it("copies the identity pubkey when the identity copy button is pressed", () => {
    const { getByTestId } = renderFields()
    fireEvent.press(getByTestId("account-info-identity-copy"))
    expect(mockCopyToClipboard).toHaveBeenCalledWith({ content: "abc-pubkey" })
  })

  it("copies the lightning address when the LN copy button is pressed", () => {
    const { getByTestId } = renderFields()
    fireEvent.press(getByTestId("account-info-lightning-address-copy"))
    expect(mockCopyToClipboard).toHaveBeenCalledWith({ content: "user@blink.sv" })
  })
})
