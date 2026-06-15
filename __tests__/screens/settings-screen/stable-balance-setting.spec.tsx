import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { StableBalanceSetting } from "@app/screens/settings-screen/settings/stable-balance"
import { AccountType } from "@app/types/wallet"

const mockNavigate = jest.fn()
const mockUseFeatureFlags = jest.fn()
const mockUseAccountRegistry = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useFeatureFlags: () => mockUseFeatureFlags(),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      StableBalance: {
        settingsRowTitle: () => "Stable Balance",
      },
    },
  }),
}))

const renderRow = () =>
  render(
    <ThemeProvider theme={theme}>
      <StableBalanceSetting />
    </ThemeProvider>,
  )

describe("StableBalanceSetting", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseFeatureFlags.mockReturnValue({
      nonCustodialEnabled: true,
      stableBalanceEnabled: true,
    })
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { type: AccountType.SelfCustodial },
    })
  })

  it("renders the row when flags are on and account is self-custodial", () => {
    const { getByText } = renderRow()

    expect(getByText("Stable Balance")).toBeTruthy()
  })

  it("navigates to stableBalanceSettings when tapped", () => {
    const { getByText } = renderRow()

    fireEvent.press(getByText("Stable Balance"))

    expect(mockNavigate).toHaveBeenCalledWith("stableBalanceSettings")
  })

  it("renders nothing when nonCustodialEnabled is false", () => {
    mockUseFeatureFlags.mockReturnValue({
      nonCustodialEnabled: false,
      stableBalanceEnabled: true,
    })

    const { queryByText } = renderRow()

    expect(queryByText("Stable Balance")).toBeNull()
  })

  it("renders nothing when stableBalanceEnabled is false", () => {
    mockUseFeatureFlags.mockReturnValue({
      nonCustodialEnabled: true,
      stableBalanceEnabled: false,
    })

    const { queryByText } = renderRow()

    expect(queryByText("Stable Balance")).toBeNull()
  })

  it("renders nothing when the active account is custodial", () => {
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { type: AccountType.Custodial },
    })

    const { queryByText } = renderRow()

    expect(queryByText("Stable Balance")).toBeNull()
  })

  it("renders nothing when there is no active account", () => {
    mockUseAccountRegistry.mockReturnValue({ activeAccount: undefined })

    const { queryByText } = renderRow()

    expect(queryByText("Stable Balance")).toBeNull()
  })
})
