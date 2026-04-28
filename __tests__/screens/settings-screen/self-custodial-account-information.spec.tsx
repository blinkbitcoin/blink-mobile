import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { AccountType } from "@app/types/wallet.types"

import { SelfCustodialAccountInformationSetting } from "@app/screens/settings-screen/settings/self-custodial-account-information"

const mockNavigate = jest.fn()
const mockUseAccountRegistry = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: { common: { accountInformation: () => "Account Information" } },
  }),
}))

jest.mock("@app/screens/settings-screen/row", () => ({
  SettingsRow: ({ title, action }: { title: string; action: () => void }) => {
    const { TouchableOpacity, Text } = jest.requireActual("react-native")
    return (
      <TouchableOpacity onPress={action} testID={`row-${title}`}>
        <Text>{title}</Text>
      </TouchableOpacity>
    )
  },
}))

describe("SelfCustodialAccountInformationSetting", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns null when active account is not self-custodial", () => {
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { type: AccountType.Custodial },
    })

    const { queryByText } = render(<SelfCustodialAccountInformationSetting />)

    expect(queryByText("Account Information")).toBeNull()
  })

  it("renders the row and navigates when self-custodial", () => {
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { type: AccountType.SelfCustodial },
    })

    const { getByTestId } = render(<SelfCustodialAccountInformationSetting />)
    fireEvent.press(getByTestId("row-Account Information"))

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialAccountInformationScreen")
  })
})
