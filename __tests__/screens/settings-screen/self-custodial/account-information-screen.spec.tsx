import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { BackupStatus } from "@app/self-custodial/providers/backup-state-provider"

import { SelfCustodialAccountInformationScreen } from "@app/screens/settings-screen/self-custodial/account-information-screen"

jest.mock("@rn-vui/themed", () => {
  const colors: Record<string, string> = {
    grey2: "#999",
    grey5: "#f5f5f5",
    black: "#000",
    error: "#f00",
  }
  return {
    makeStyles:
      (
        fn: (
          theme: { colors: Record<string, string> },
          params: Record<string, string | undefined>,
        ) => Record<string, object>,
      ) =>
      (params: Record<string, string | undefined> = {}) =>
        fn({ colors }, params),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    useTheme: () => ({ theme: { colors } }),
  }
})

jest.mock("@app/components/screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) =>
    React.createElement("Screen", null, children),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

const mockUseAccountInfo = jest.fn()
const mockUseBackupState = jest.fn()
const mockCopyToClipboard = jest.fn()

jest.mock("@app/self-custodial/hooks/use-self-custodial-account-info", () => ({
  useSelfCustodialAccountInfo: () => mockUseAccountInfo(),
}))

jest.mock("@app/self-custodial/providers/backup-state-provider", () => ({
  BackupStatus: { Completed: "completed", Pending: "pending" },
  useBackupState: () => mockUseBackupState(),
}))

jest.mock("@app/hooks", () => ({
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      SettingsScreen: {
        AccountInformation: {
          accountTypeLabel: () => "Account type",
          identityLabel: () => "Identity",
          lightningAddressLabel: () => "Lightning address",
          backupStatusLabel: () => "Backup status",
          backupStatusCompleted: () => "Backup complete",
          backupStatusNotCompleted: () => "Backup pending",
          loadError: () => "Could not load your account information.",
        },
      },
      AccountTypeSelectionScreen: {
        selfCustodialLabel: () => "Non-custodial",
      },
    },
  }),
}))

describe("SelfCustodialAccountInformationScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseBackupState.mockReturnValue({
      backupState: { status: BackupStatus.Completed },
    })
  })

  it("renders an error message when the info hook reports an error", () => {
    mockUseAccountInfo.mockReturnValue({
      identityPubkey: "",
      lightningAddress: null,
      loading: false,
      error: new Error("network down"),
    })

    const { getByTestId, getByText } = render(<SelfCustodialAccountInformationScreen />)

    expect(getByTestId("account-info-error")).toBeTruthy()
    expect(getByText("Could not load your account information.")).toBeTruthy()
  })

  it("renders the identity, lightning address, and backup status when info loads", () => {
    mockUseAccountInfo.mockReturnValue({
      identityPubkey: "abc123",
      lightningAddress: "user@spark.tips",
      loading: false,
      error: null,
    })

    const { getByText, getByTestId } = render(<SelfCustodialAccountInformationScreen />)

    expect(getByText("abc123")).toBeTruthy()
    expect(getByText("user@spark.tips")).toBeTruthy()
    expect(getByTestId("account-info-backup-status").props.children).toBe(
      "Backup complete",
    )
  })

  it("hides the lightning address row when not yet registered", () => {
    mockUseAccountInfo.mockReturnValue({
      identityPubkey: "abc123",
      lightningAddress: null,
      loading: false,
      error: null,
    })

    const { queryByText } = render(<SelfCustodialAccountInformationScreen />)

    expect(queryByText("Lightning address")).toBeNull()
  })

  it("copies the identity pubkey to the clipboard when its copy button is pressed", () => {
    mockUseAccountInfo.mockReturnValue({
      identityPubkey: "pubkey-xyz",
      lightningAddress: null,
      loading: false,
      error: null,
    })

    const { getByTestId } = render(<SelfCustodialAccountInformationScreen />)
    fireEvent.press(getByTestId("account-info-identity-copy"))

    expect(mockCopyToClipboard).toHaveBeenCalledWith({ content: "pubkey-xyz" })
  })

  it("renders the backup-pending label when the wallet has no completed backup", () => {
    mockUseBackupState.mockReturnValue({
      backupState: { status: BackupStatus.Pending },
    })
    mockUseAccountInfo.mockReturnValue({
      identityPubkey: "abc123",
      lightningAddress: null,
      loading: false,
      error: null,
    })

    const { getByTestId } = render(<SelfCustodialAccountInformationScreen />)

    expect(getByTestId("account-info-backup-status").props.children).toBe(
      "Backup pending",
    )
  })
})
