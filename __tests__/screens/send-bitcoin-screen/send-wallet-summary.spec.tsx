import React from "react"
import { StyleSheet, Text } from "react-native"
import { render, screen, within } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { WalletCurrency } from "@app/graphql/generated"
import theme from "@app/rne-theme/theme"
import { SendWalletSummary } from "@app/screens/send-bitcoin-screen/amount-entry/send-wallet-summary"

jest.mock("@app/components/wallet-switch", () => ({
  WalletSwitch: () => null,
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: { common: { bitcoin: () => "Bitcoin", dollar: () => "Dollar" } },
  }),
}))

const CARD = "choose-wallet-to-send-from"

const bitcoinCard = (
  <ThemeProvider theme={theme}>
    <SendWalletSummary
      currency={WalletCurrency.Btc}
      balancePrimary="741 SAT"
      balanceSecondary="~ $0.57"
    />
  </ThemeProvider>
)

const dollarCardWithoutSecondary = (
  <ThemeProvider theme={theme}>
    <SendWalletSummary currency={WalletCurrency.Usd} balancePrimary="$0.57" />
  </ThemeProvider>
)

const balanceLines = () => within(screen.getByTestId(CARD)).UNSAFE_queryAllByType(Text)

/**
 * A dollar wallet shown in USD has no second denomination. The card still lays that line out
 * (hidden) so it is the same height whichever wallet is selected, at any text size.
 */
describe("SendWalletSummary", () => {
  it("lays out the second line even when there is no second denomination", () => {
    render(bitcoinCard)
    const withSecondary = balanceLines().length

    screen.rerender(dollarCardWithoutSecondary)

    const lines = balanceLines()
    expect(lines).toHaveLength(withSecondary)
    expect(StyleSheet.flatten(lines[lines.length - 1].props.style).opacity).toBe(0)
  })

  it("shows the second line when there is one", () => {
    render(bitcoinCard)

    const line = screen.getByText("~ $0.57")
    expect(StyleSheet.flatten(line.props.style).opacity).toBeUndefined()
  })
})
