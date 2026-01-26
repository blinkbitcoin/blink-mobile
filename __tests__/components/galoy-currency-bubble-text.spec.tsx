import React from "react"
import { Text as ReactNativeText } from "react-native"
import { render } from "@testing-library/react-native"

import { GaloyCurrencyBubbleText } from "@app/components/atomic/galoy-currency-bubble-text/galoy-currency-bubble-text"
import { WalletCurrency } from "@app/graphql/generated"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof ReactNativeText>) => (
    <ReactNativeText {...props} />
  ),
  useTheme: () => ({
    theme: {
      colors: {
        white: "white",
        _white: "_white",
        primary: "primary",
        _green: "_green",
        grey3: "grey3",
      },
    },
  }),
  makeStyles: () => () => ({
    container: {},
    text: {},
  }),
}))

describe("GaloyCurrencyBubbleText", () => {
  it("renders BTC text when currency is Btc", () => {
    const { getByText } = render(
      <GaloyCurrencyBubbleText currency={WalletCurrency.Btc} />,
    )

    expect(getByText("BTC")).toBeTruthy()
  })

  it("renders USD text when currency is Usd", () => {
    const { getByText } = render(
      <GaloyCurrencyBubbleText currency={WalletCurrency.Usd} />,
    )

    expect(getByText("USD")).toBeTruthy()
  })

  it("renders with highlighted by default", () => {
    const { getByText } = render(
      <GaloyCurrencyBubbleText currency={WalletCurrency.Btc} />,
    )

    expect(getByText("BTC")).toBeTruthy()
  })

  it("renders without highlighting when highlighted is false", () => {
    const { getByText } = render(
      <GaloyCurrencyBubbleText currency={WalletCurrency.Btc} highlighted={false} />,
    )

    expect(getByText("BTC")).toBeTruthy()
  })

  it("renders with small container size by default", () => {
    const { getByText } = render(
      <GaloyCurrencyBubbleText currency={WalletCurrency.Usd} />,
    )

    expect(getByText("USD")).toBeTruthy()
  })

  it("renders with medium container size", () => {
    const { getByText } = render(
      <GaloyCurrencyBubbleText currency={WalletCurrency.Btc} containerSize="medium" />,
    )

    expect(getByText("BTC")).toBeTruthy()
  })

  it("renders with large container size", () => {
    const { getByText } = render(
      <GaloyCurrencyBubbleText currency={WalletCurrency.Usd} containerSize="large" />,
    )

    expect(getByText("USD")).toBeTruthy()
  })
})
