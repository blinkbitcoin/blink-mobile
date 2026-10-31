import React from "react"
import { StyleSheet, Text } from "react-native"
import { render, screen, within } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import {
  WALLET_SUMMARY_SECONDARY_TEST_ID,
  WALLET_SUMMARY_SIZER_TEST_ID,
  WALLET_SUMMARY_TEST_ID,
  WalletSummary,
} from "@app/components/wallet-summary"
import { WalletCurrency } from "@app/graphql/generated"
import theme from "@app/rne-theme/theme"

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: { common: { bitcoin: () => "Bitcoin", dollar: () => "Dollar" } },
  }),
}))

const renderCard = (props: React.ComponentProps<typeof WalletSummary>) =>
  render(
    <ThemeProvider theme={theme}>
      <WalletSummary {...props} />
    </ThemeProvider>,
  )

describe("WalletSummary", () => {
  it("shows the display-currency value under the balance when there is one", () => {
    renderCard({
      currency: WalletCurrency.Btc,
      balancePrimary: "741 SAT",
      balanceSecondary: "~ $0.57",
    })

    expect(screen.getByTestId(WALLET_SUMMARY_SECONDARY_TEST_ID)).toBeTruthy()
  })

  it("shows a single line when there is no second denomination", () => {
    renderCard({ currency: WalletCurrency.Usd, balancePrimary: "$0.57" })

    expect(screen.queryByTestId(WALLET_SUMMARY_SECONDARY_TEST_ID)).toBeNull()
  })

  /** The single line sits in the middle of a card as tall as the two-line one. */
  it("keeps the two-line height with a hidden copy", () => {
    renderCard({ currency: WalletCurrency.Usd, balancePrimary: "$0.57" })

    const hiddenCopy = screen.getByTestId(WALLET_SUMMARY_SIZER_TEST_ID, {
      includeHiddenElements: true,
    })
    expect(StyleSheet.flatten(hiddenCopy.props.style).opacity).toBe(0)
    expect(within(hiddenCopy).UNSAFE_queryAllByType(Text)).toHaveLength(2)
  })

  /** A read-out, not a control: one element named by wallet and amount, on grey7. */
  it("reads as the wallet and its amount, on the static surface", () => {
    renderCard({ currency: WalletCurrency.Btc, balancePrimary: "741 SAT" })

    const card = screen.getByTestId(WALLET_SUMMARY_TEST_ID)
    expect(card.props.accessibilityLabel).toBe("Bitcoin, 741 SAT")
    expect(card.props.accessibilityRole).toBeUndefined()
    expect(StyleSheet.flatten(card.props.style).backgroundColor).toBe(
      theme.lightColors?.grey7,
    )
  })
})
