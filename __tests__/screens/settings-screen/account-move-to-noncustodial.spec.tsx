import React from "react"
import { render, screen, fireEvent } from "@testing-library/react-native"

import { MoveToNonCustodialSetting } from "@app/screens/settings-screen/settings/account-move-to-noncustodial"
import { AccountType } from "@app/types/wallet"

const mockNavigate = jest.fn()
const mockNavigateToCheckpoint = jest.fn()
const mockActiveAccount = jest.fn()
const mockUseMigrationCheckpoint = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

let mockFeatureFlags = { nonCustodialEnabled: true, remoteConfigReady: true }

jest.mock("@app/config/feature-flags-context", () => ({
  ...jest.requireActual("@app/config/feature-flags-context"),
  useFeatureFlags: () => mockFeatureFlags,
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount() }),
}))

jest.mock("@app/screens/account-migration/hooks", () => ({
  useMigrationCheckpoint: () => mockUseMigrationCheckpoint(),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AccountMigration: {
        moveToNonCustodial: () => "Move to self-custodial",
      },
    },
  }),
}))

jest.mock("@app/screens/settings-screen/row", () => ({
  SettingsRow: ({ title, action }: { title: string; action: () => void }) => {
    const { Text } = jest.requireActual("react-native")
    return (
      <Text testID="settings-row" onPress={action}>
        {title}
      </Text>
    )
  },
}))

describe("MoveToNonCustodialSetting", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveAccount.mockReturnValue({ type: AccountType.Custodial })
    mockFeatureFlags = { nonCustodialEnabled: true, remoteConfigReady: true }
    mockUseMigrationCheckpoint.mockReturnValue({
      loading: false,
      navigateToCheckpoint: mockNavigateToCheckpoint,
      hasResumableCheckpoint: false,
    })
  })

  it("renders for custodial accounts", () => {
    render(<MoveToNonCustodialSetting />)

    expect(screen.getByTestId("settings-row")).toBeTruthy()
  })

  it("does not render for self-custodial accounts", () => {
    mockActiveAccount.mockReturnValue({ type: AccountType.SelfCustodial })

    render(<MoveToNonCustodialSetting />)

    expect(screen.queryByTestId("settings-row")).toBeNull()
  })

  it("renders when no active account", () => {
    mockActiveAccount.mockReturnValue(undefined)

    render(<MoveToNonCustodialSetting />)

    expect(screen.getByTestId("settings-row")).toBeTruthy()
  })

  it("starts the migration flow when there is no resumable checkpoint", () => {
    render(<MoveToNonCustodialSetting />)

    fireEvent.press(screen.getByTestId("settings-row"))

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationStart")
  })

  it("resumes the saved checkpoint when there is one", () => {
    mockUseMigrationCheckpoint.mockReturnValue({
      loading: false,
      navigateToCheckpoint: mockNavigateToCheckpoint,
      hasResumableCheckpoint: true,
    })

    render(<MoveToNonCustodialSetting />)

    fireEvent.press(screen.getByTestId("settings-row"))

    expect(mockNavigateToCheckpoint).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("hides the entry while the self-custodial kill-switch is off", () => {
    mockFeatureFlags = { nonCustodialEnabled: false, remoteConfigReady: true }

    render(<MoveToNonCustodialSetting />)

    expect(screen.queryByTestId("settings-row")).toBeNull()
  })
})
