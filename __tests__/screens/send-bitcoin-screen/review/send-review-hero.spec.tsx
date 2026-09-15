import React from "react"
import { StyleSheet } from "react-native"
import { ReactTestInstance } from "react-test-renderer"
import { render, screen } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import {
  SEND_REVIEW_PRIMARY_TEST_ID,
  SEND_REVIEW_SECONDARY_TEST_ID,
  SendReviewHero,
} from "@app/screens/send-bitcoin-screen/review/send-review-hero"

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: { SendBitcoinConfirmationScreen: { sending: () => "Sending" } },
  }),
}))

const renderHero = (secondaryAmount?: string) =>
  render(
    <ThemeProvider theme={theme}>
      <SendReviewHero primaryAmount="$0.57" secondaryAmount={secondaryAmount} />
    </ThemeProvider>,
  )

describe("SendReviewHero", () => {
  it("shows Sending, the amount and the wallet-unit amount", () => {
    renderHero("746 SAT")

    expect(screen.getByText("Sending")).toBeTruthy()
    expect(screen.getByTestId(SEND_REVIEW_PRIMARY_TEST_ID).props.children).toBe("$0.57")
    expect(screen.getByTestId(SEND_REVIEW_SECONDARY_TEST_ID).props.children).toBe(
      "746 SAT",
    )
  })

  it("drops the second line when there is no second currency", () => {
    renderHero()

    expect(screen.queryByTestId(SEND_REVIEW_SECONDARY_TEST_ID)).toBeNull()
  })

  it("draws the send icon at 32 with no background behind it", () => {
    renderHero()

    const icon = screen.getByTestId("icon-send")
    const frame = icon.parent?.parent
    expect(StyleSheet.flatten(frame?.props.style)).toEqual(
      expect.objectContaining({ width: 44, height: 44 }),
    )
    expect(StyleSheet.flatten(frame?.props.style).backgroundColor).toBeUndefined()
  })

  it("uses Figma's type sizes for the three lines", () => {
    renderHero("746 SAT")

    const style = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style)
    expect(style(screen.getByText("Sending"))).toEqual(
      expect.objectContaining({ fontSize: 12, lineHeight: 18 }),
    )
    expect(style(screen.getByTestId(SEND_REVIEW_PRIMARY_TEST_ID))).toEqual(
      expect.objectContaining({ fontSize: 20, lineHeight: 24 }),
    )
    expect(style(screen.getByTestId(SEND_REVIEW_SECONDARY_TEST_ID))).toEqual(
      expect.objectContaining({ fontSize: 14, lineHeight: 20 }),
    )
  })
})
