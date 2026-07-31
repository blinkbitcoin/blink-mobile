import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { AccountModeSetting } from "@app/screens/settings-screen/self-custodial/account-mode"
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

let mockIsRestrictedRegion = false
const mockPresentRestrictedRegionModal = jest.fn()
jest.mock("@app/components/restricted-region", () => ({
  useRestrictedRegion: () => ({
    isRestrictedRegion: mockIsRestrictedRegion,
    isRestrictedRegionModalVisible: false,
    presentRestrictedRegionModal: mockPresentRestrictedRegionModal,
  }),
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
    mockIsRestrictedRegion = false
  })

  it("renders nothing for a custodial account", () => {
    mockActiveAccountType = AccountType.Custodial

    const { toJSON } = renderRow()

    expect(toJSON()).toBeNull()
  })

  it("reads the Enhanced default for an account that has not chosen a mode", () => {
    const { getByText } = renderRow()

    fireEvent.press(getByText("Mode: Enhanced"))

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

  /** The stored value stays `anon`; only the label the user reads is Incognito. */
  it("opens the mode selection screen from the Incognito row", () => {
    mockAccountMode = AccountMode.Anon

    const { getByText } = renderRow()

    fireEvent.press(getByText("Mode: Incognito"))

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialChooseExperience", {
      entry: "settings",
    })
  })

  it("blocks the mode switch behind the restricted-region modal while restricted", () => {
    mockIsRestrictedRegion = true
    mockAccountMode = AccountMode.Enhanced

    const { getByLabelText } = renderRow()

    /** The gated row leaves the accessibility tree; the gate stands in for it. */
    fireEvent.press(getByLabelText("Mode: Enhanced"))

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockPresentRestrictedRegionModal).toHaveBeenCalledTimes(1)
  })
})
