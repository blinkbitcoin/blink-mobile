import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { AccountModeSetting } from "@app/screens/settings-screen/settings/account-mode"
import { AccountMode } from "@app/types/account"
import { AccountType } from "@app/types/wallet"

let mockAccountMode: AccountMode | null = null
let mockActiveAccountType: AccountType = AccountType.SelfCustodial
const mockNavigate = jest.fn()

jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({
    accountMode: mockAccountMode,
    isAnonMode: mockAccountMode === "anon",
  }),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: { type: mockActiveAccountType } }),
}))

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      SettingsScreen: {
        mode: () => "Mode",
      },
    },
  }),
}))

const renderRow = () =>
  render(
    <ThemeProvider theme={theme}>
      <AccountModeSetting />
    </ThemeProvider>,
  )

describe("AccountModeSetting", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAccountMode = null
    mockActiveAccountType = AccountType.SelfCustodial
  })

  it("renders nothing for a custodial account", () => {
    mockActiveAccountType = AccountType.Custodial

    const { toJSON } = renderRow()

    expect(toJSON()).toBeNull()
  })

  it("shows the bare row for a self-custodial account that has not chosen a mode", () => {
    const { getByText } = renderRow()

    fireEvent.press(getByText("Mode"))

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialChooseExperience", {
      entry: "settings",
    })
  })

  it("opens the mode selection screen from the Enhanced row", () => {
    mockAccountMode = AccountMode.Enhanced

    const { getByText } = renderRow()

    fireEvent.press(getByText("Mode: Enhanced"))

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialChooseExperience", {
      entry: "settings",
    })
  })

  it("opens the mode selection screen from the Anon row", () => {
    mockAccountMode = AccountMode.Anon

    const { getByText } = renderRow()

    fireEvent.press(getByText("Mode: Anon"))

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialChooseExperience", {
      entry: "settings",
    })
  })
})
