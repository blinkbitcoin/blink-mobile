import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { FeeRatesSetting } from "@app/screens/settings-screen/settings/fee-rates"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
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
})
