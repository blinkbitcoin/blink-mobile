import React from "react"
import { render } from "@testing-library/react-native"

import { MoveToNonCustodialSetting } from "@app/screens/settings-screen/settings/account-move-to-noncustodial"
import { AccountType } from "@app/types/wallet"

const mockNavigate = jest.fn()
const mockActiveAccount = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount() }),
}))

jest.mock("@app/screens/account-migration/hooks", () => ({
  useMigrationCheckpoint: () => ({
    loading: false,
    getRouteForCheckpoint: () => "sparkMigrationExplainer",
  }),
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
  SettingsRow: ({ title }: { title: string }) => {
    const { Text } = jest.requireActual("react-native")
    return <Text testID="settings-row">{title}</Text>
  },
}))

describe("MoveToNonCustodialSetting", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders for custodial accounts", () => {
    mockActiveAccount.mockReturnValue({
      type: AccountType.Custodial,
    })

    const { getByTestId } = render(<MoveToNonCustodialSetting />)

    expect(getByTestId("settings-row")).toBeTruthy()
  })

  it("does not render for self-custodial accounts", () => {
    mockActiveAccount.mockReturnValue({
      type: AccountType.SelfCustodial,
    })

    const { queryByTestId } = render(<MoveToNonCustodialSetting />)

    expect(queryByTestId("settings-row")).toBeNull()
  })

  it("renders when no active account", () => {
    mockActiveAccount.mockReturnValue(undefined)

    const { getByTestId } = render(<MoveToNonCustodialSetting />)

    expect(getByTestId("settings-row")).toBeTruthy()
  })
})
