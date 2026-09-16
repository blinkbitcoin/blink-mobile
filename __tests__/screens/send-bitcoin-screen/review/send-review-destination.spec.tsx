import React from "react"
import { StyleSheet } from "react-native"
import { fireEvent, render, screen, within } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { WalletCurrency } from "@app/graphql/generated"
import { light } from "@app/rne-theme/colors"
import theme from "@app/rne-theme/theme"
import { PaymentDetail } from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import {
  SEND_REVIEW_COPY_TEST_ID,
  SEND_REVIEW_DESTINATION_TEST_ID,
  SendReviewDestination,
} from "@app/screens/send-bitcoin-screen/review/send-review-destination"

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

    expect(screen.getByTestId(SEND_REVIEW_DESTINATION_TEST_ID).props.children).toBe(
      "andrejstack@blink.sv",
    )
  })

  /** The field shortens it natively at its own width, so the text node gets it whole. */
  it("hands a raw address to the field whole, to shorten in the middle", () => {
    const address = "bc1pnu7735ce8vd9dknqyy2mnq0cq5g7yv8aqhmpyl6rnmgk0xz6qq9qtqasq6n3"
    renderDestination("onchain", address)

    const value = screen.getByTestId(SEND_REVIEW_DESTINATION_TEST_ID)
    expect(value.props.children).toBe(address)
    expect(value.props.numberOfLines).toBe(1)
    expect(value.props.ellipsizeMode).toBe("middle")
  })

  it("draws the destination in the foreground colour", () => {
    renderDestination("intraledger")

    expect(
      StyleSheet.flatten(screen.getByTestId(SEND_REVIEW_DESTINATION_TEST_ID).props.style)
        .color,
    ).toBe(light.black)
  })

  /** The whole field copies, not only the icon. */
  it("copies when the field itself is pressed", () => {
    const onCopy = jest.fn()
    renderDestination("intraledger", "andrejstack", onCopy)

    const field = screen.getByTestId(SEND_REVIEW_COPY_TEST_ID)
    expect(within(field).getByTestId(SEND_REVIEW_DESTINATION_TEST_ID)).toBeTruthy()
    expect(within(field).getByTestId("icon-copy-paste")).toBeTruthy()

    fireEvent.press(field)

    expect(onCopy).toHaveBeenCalledTimes(1)
  })
})
