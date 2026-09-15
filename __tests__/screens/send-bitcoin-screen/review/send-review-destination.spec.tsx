import React from "react"
import { StyleSheet } from "react-native"
import { fireEvent, render, screen, within } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { WalletCurrency } from "@app/graphql/generated"
import { light } from "@app/rne-theme/colors"
import theme from "@app/rne-theme/theme"
import { PaymentDetail } from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { SendReviewDestination } from "@app/screens/send-bitcoin-screen/review/send-review-destination"

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: { galoyInstance: { lnAddressHostname: "blink.sv" } },
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      SendBitcoinScreen: { destination: () => "Destination" },
      common: {
        intraledger: () => "Intraledger",
        onchain: () => "Onchain",
        lightning: () => "Lightning",
        spark: () => "Spark",
      },
    },
  }),
}))

type PaymentType = PaymentDetail<WalletCurrency>["paymentType"]

const renderDestination = (
  paymentType: PaymentType,
  destination = "andrejstack",
  onCopy = jest.fn(),
) =>
  render(
    <ThemeProvider theme={theme}>
      <SendReviewDestination
        destination={destination}
        paymentType={paymentType}
        onCopy={onCopy}
      />
    </ThemeProvider>,
  )

describe("SendReviewDestination", () => {
  const titles: [PaymentType, string][] = [
    ["intraledger", "Destination - Intraledger"],
    ["onchain", "Destination - Onchain"],
    ["lightning", "Destination - Lightning"],
    ["lnurl", "Destination - Lightning"],
    // Self-custodial Spark sends reach review with a "spark" type the shared union omits.
    ["spark" as PaymentType, "Destination - Spark"],
  ]

  titles.forEach(([paymentType, title]) => {
    it(`titles a ${paymentType} destination "${title}"`, () => {
      renderDestination(paymentType)

      expect(screen.getByText(title)).toBeTruthy()
    })
  })

  it("appends the host to a Blink username", () => {
    renderDestination("intraledger")

    expect(screen.getByTestId("send-review-destination").props.children).toBe(
      "andrejstack@blink.sv",
    )
  })

  it("draws the destination in the foreground colour", () => {
    renderDestination("intraledger")

    expect(
      StyleSheet.flatten(screen.getByTestId("send-review-destination").props.style).color,
    ).toBe(light.black)
  })

  /** The whole field copies, not only the icon. */
  it("copies when the field itself is pressed", () => {
    const onCopy = jest.fn()
    renderDestination("intraledger", "andrejstack", onCopy)

    const field = screen.getByTestId("send-review-copy-destination")
    expect(within(field).getByTestId("send-review-destination")).toBeTruthy()
    expect(within(field).getByTestId("icon-copy-paste")).toBeTruthy()

    fireEvent.press(field)

    expect(onCopy).toHaveBeenCalledTimes(1)
  })
})
