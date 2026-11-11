import React from "react"
import { StyleSheet } from "react-native"
import { render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { SubscriptionOfferCard } from "@app/components/card-screen/subscription-offer-card"
import theme from "@app/rne-theme/theme"
import { light } from "@app/rne-theme/colors"

const renderCard = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

describe("SubscriptionOfferCard", () => {
  it("shows the offer's title, price, caption and rows", () => {
    const { getByText } = renderCard(
      <SubscriptionOfferCard
        title="Blink Orange"
        price="Free"
        priceTone="positive"
        caption="for now"
        rows={[
          { label: "Blink Card", value: "$0.00", tone: "default" },
          { label: "Other member benefits", value: "$0.01", tone: "default" },
        ]}
      />,
    )

    expect(getByText("Blink Orange")).toBeTruthy()
    expect(getByText("Free")).toBeTruthy()
    expect(getByText("for now")).toBeTruthy()
    expect(getByText("Blink Card")).toBeTruthy()
    expect(getByText("$0.00")).toBeTruthy()
    expect(getByText("Other member benefits")).toBeTruthy()
    expect(getByText("$0.01")).toBeTruthy()
  })

  it("colors each value by its tone", () => {
    const { getByText } = renderCard(
      <SubscriptionOfferCard
        title="Blink Orange"
        price="$1,000.00"
        priceTone="accent"
        caption="per year"
        rows={[
          { label: "Special offer", value: "First year free", tone: "positive" },
          { label: "Renewal date", value: "Nov 10, 2027", tone: "default" },
        ]}
      />,
    )

    expect(StyleSheet.flatten(getByText("$1,000.00").props.style).color).toBe(
      light.primary,
    )
    expect(StyleSheet.flatten(getByText("First year free").props.style).color).toBe(
      light._green,
    )
    expect(StyleSheet.flatten(getByText("Nov 10, 2027").props.style).color).toBe(
      light.black,
    )
  })
})
