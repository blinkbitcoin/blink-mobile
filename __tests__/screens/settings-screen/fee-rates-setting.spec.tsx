import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { FeeRatesSetting } from "@app/screens/settings-screen/settings/fee-rates"
import { AccountType } from "@app/types/wallet"

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
    LL: {
      common: {
        feeRates: () => "Fee rates",
      },
    },
  }),
}))

const renderRow = () =>
  render(
    <ThemeProvider theme={theme}>
      <FeeRatesSetting />
    </ThemeProvider>,
  )

describe("FeeRatesSetting", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { type: AccountType.Custodial },
    })
  })

  it("renders the row", () => {
    const { getByText } = renderRow()

    expect(getByText("Fee rates")).toBeTruthy()
  })

  it("navigates to feeRatesScreen when tapped", () => {
    const { getByText } = renderRow()

    fireEvent.press(getByText("Fee rates"))

    expect(mockNavigate).toHaveBeenCalledWith("feeRatesScreen")
  })

  it("renders nothing for a self-custodial account", () => {
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { type: AccountType.SelfCustodial },
    })

    const { queryByText } = renderRow()

    expect(queryByText("Fee rates")).toBeNull()
  })
})
