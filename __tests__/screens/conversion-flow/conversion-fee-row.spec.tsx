import React from "react"
import { ActivityIndicator } from "react-native"
import { render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { ConversionFeeRow } from "@app/screens/conversion-flow/conversion-fee-row"

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      ConversionConfirmationScreen: {
        feeLabel: () => "Conversion fee",
        feeError: () => "Couldn't fetch the conversion fee",
      },
    },
  }),
}))

const renderRow = (props: React.ComponentProps<typeof ConversionFeeRow>) =>
  render(
    <ThemeProvider theme={theme}>
      <ConversionFeeRow {...props} />
    </ThemeProvider>,
  )

describe("ConversionFeeRow", () => {
  it("shows the loading spinner while the quote is being fetched", () => {
    const rendered = renderRow({
      feeText: "",
      adjustmentText: null,
      isLoading: true,
      hasError: false,
    })

    expect(rendered.UNSAFE_getByType(ActivityIndicator)).toBeTruthy()
    expect(rendered.queryByText("Conversion fee")).toBeNull()
  })

  it("shows the fee value when the quote is ready", () => {
    const { getByText, queryByText } = renderRow({
      feeText: "$0.05",
      adjustmentText: null,
      isLoading: false,
      hasError: false,
    })

    expect(getByText("Conversion fee")).toBeTruthy()
    expect(getByText("$0.05")).toBeTruthy()
    expect(queryByText("Couldn't fetch the conversion fee")).toBeNull()
  })

  it("swaps the fee value for an error message when hasError is true", () => {
    const { getByText, queryByText } = renderRow({
      feeText: "$0.05",
      adjustmentText: null,
      isLoading: false,
      hasError: true,
    })

    expect(getByText("Couldn't fetch the conversion fee")).toBeTruthy()
    expect(queryByText("$0.05")).toBeNull()
  })

  it("renders the adjustment line when provided", () => {
    const { getByText } = renderRow({
      feeText: "$0.05",
      adjustmentText: "Amount increased to meet the conversion minimum.",
      isLoading: false,
      hasError: false,
    })

    expect(getByText("Amount increased to meet the conversion minimum.")).toBeTruthy()
  })

  it("omits the adjustment line when null", () => {
    const { queryByText } = renderRow({
      feeText: "$0.05",
      adjustmentText: null,
      isLoading: false,
      hasError: false,
    })

    expect(queryByText(/increased/i)).toBeNull()
  })
})
