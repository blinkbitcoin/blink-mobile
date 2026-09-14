import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { AmountBadge } from "@app/components/amount-badge"
import { PendingAmountBadge } from "@app/components/pending-amount-badge"

jest.mock("@app/components/animations", () => ({
  useDropInOutAnimation: () => ({ opacity: 1, translateY: 0 }),
}))

const renderBadge = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

describe("AmountBadge", () => {
  it("renders a leading icon only when one is asked for", () => {
    const { queryByTestId } = renderBadge(
      <AmountBadge amountText="+$78.31" variant="pending" iconName="chain" />,
    )

    expect(queryByTestId("icon-chain")).toBeTruthy()

    const { queryByTestId: queryWithoutIcon } = renderBadge(
      <AmountBadge amountText="+$78.31" variant="incoming" />,
    )

    expect(queryWithoutIcon("icon-chain")).toBeNull()
  })

  /** The whole point of #4120: the badge sits in a fixed-height slot, so an
   *  enlarged system font must truncate rather than overrun it. */
  it("caps font scaling and keeps the amount on one line", () => {
    const { getByText } = renderBadge(
      <AmountBadge amountText="+$1,234,567.89" variant="pending" iconName="chain" />,
    )

    const amount = getByText("+$1,234,567.89")
    expect(amount.props.maxFontSizeMultiplier).toBe(1.4)
    expect(amount.props.numberOfLines).toBe(1)
    expect(amount.props.ellipsizeMode).toBe("tail")
  })

  it("is not pressable without an onPress", () => {
    const { getByLabelText } = renderBadge(
      <AmountBadge amountText="+$1.00" variant="pending" />,
    )

    const badge = getByLabelText("+$1.00")
    expect(badge.props.accessibilityRole).toBe("text")
    expect(badge.props.accessibilityState?.disabled).toBe(true)
  })

  it("announces the accessibility label instead of the bare amount when given one", () => {
    const { getByLabelText, queryByLabelText } = renderBadge(
      <AmountBadge
        amountText="+$78.31"
        variant="pending"
        accessibilityLabel="+$78.31 pending"
      />,
    )

    expect(getByLabelText("+$78.31 pending")).toBeTruthy()
    expect(queryByLabelText("+$78.31")).toBeNull()
  })
})

describe("PendingAmountBadge", () => {
  it("renders the chain icon and carries its press action", () => {
    const onPress = jest.fn()
    const { getByTestId } = renderBadge(
      <PendingAmountBadge amountText="+$78.31" onPress={onPress} />,
    )

    const badge = getByTestId("pending-receive-badge")
    expect(getByTestId("icon-chain")).toBeTruthy()

    fireEvent.press(badge)
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
