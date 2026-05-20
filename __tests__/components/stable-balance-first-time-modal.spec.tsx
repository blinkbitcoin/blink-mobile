import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"

import { StableBalanceFirstTimeModal } from "@app/components/stable-balance-first-time-modal"

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      StableBalance: {
        firstTimeModal: {
          title: () => "About Convert",
          dualBalance: () => "BTC and USD are two independent balances.",
          trustDisclosure: () => "USD mode uses USDB tokens on Spark.",
          acknowledge: () => "I understand",
        },
      },
    },
  }),
}))

const renderModal = (
  props: Partial<React.ComponentProps<typeof StableBalanceFirstTimeModal>> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <StableBalanceFirstTimeModal isVisible onAcknowledge={jest.fn()} {...props} />
    </ThemeProvider>,
  )

describe("StableBalanceFirstTimeModal", () => {
  it("renders both explanation paragraphs when visible", () => {
    const { getByText } = renderModal()

    expect(getByText("BTC and USD are two independent balances.")).toBeTruthy()
    expect(getByText("USD mode uses USDB tokens on Spark.")).toBeTruthy()
  })

  it("renders the acknowledge CTA text", () => {
    const { getByText } = renderModal()

    expect(getByText("I understand")).toBeTruthy()
  })

  it("exposes the modal testID for targeting from the Convert flow", () => {
    const { getByTestId } = renderModal()

    expect(getByTestId("stable-balance-first-time-modal")).toBeTruthy()
  })

  it("calls onAcknowledge when the CTA is tapped", () => {
    const onAcknowledge = jest.fn()
    const { getByText } = renderModal({ onAcknowledge })

    fireEvent.press(getByText("I understand"))

    expect(onAcknowledge).toHaveBeenCalledTimes(1)
  })
})
