import React from "react"
import { StyleSheet, Text } from "react-native"
import { fireEvent, render, screen, within } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { WalletCurrency } from "@app/graphql/generated"
import { light } from "@app/rne-theme/colors"
import theme from "@app/rne-theme/theme"
import {
  SEND_WALLET_LINES_TEST_ID,
  SEND_WALLET_SECONDARY_TEST_ID,
  SEND_WALLET_SIZER_TEST_ID,
  SendWalletSummary,
} from "@app/screens/send-bitcoin-screen/amount-entry/send-wallet-summary"

jest.mock("@app/components/wallet-switch", () => ({
  WalletSwitch: () => null,
}))

jest.mock("@app/components/hidden-balance-placeholder/hidden-balance-placeholder", () => {
  const { View } = jest.requireActual("react-native")
  return { HiddenBalancePlaceholder: () => <View testID="hidden-balance-placeholder" /> }
})

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: { common: { bitcoin: () => "Bitcoin", dollar: () => "Dollar" } },
  }),
}))

const bitcoinCard = (
  <ThemeProvider theme={theme}>
    <SendWalletSummary
      currency={WalletCurrency.Btc}
      balancePrimary="741 SAT"
      balanceSecondary="~ $0.57"
    />
  </ThemeProvider>
)

/** A dollar wallet with USD as the display currency: no second denomination. */
const dollarCardInUsd = (
  <ThemeProvider theme={theme}>
    <SendWalletSummary currency={WalletCurrency.Usd} balancePrimary="$0.57" />
  </ThemeProvider>
)

const primaryLine = (currency: WalletCurrency) =>
  screen.getByTestId(`${currency} Wallet Balance`)

describe("SendWalletSummary", () => {
  it("shows the display-currency value under the balance when there is one", () => {
    render(bitcoinCard)

    expect(screen.getByTestId(SEND_WALLET_SECONDARY_TEST_ID)).toBeTruthy()
  })

  it("shows a single line when there is no second denomination", () => {
    render(dollarCardInUsd)

    expect(primaryLine(WalletCurrency.Usd)).toBeTruthy()
    expect(screen.queryByTestId(SEND_WALLET_SECONDARY_TEST_ID)).toBeNull()
  })

  /**
   * The visible lines are centred over a hidden two-line copy, so the single line sits in the
   * middle of a card that is exactly as tall as the two-line one, at any text size.
   */
  it("keeps the two-line height and centres the single line", () => {
    render(dollarCardInUsd)

    const hiddenCopy = screen.getByTestId(SEND_WALLET_SIZER_TEST_ID, {
      includeHiddenElements: true,
    })
    expect(StyleSheet.flatten(hiddenCopy.props.style).opacity).toBe(0)
    expect(within(hiddenCopy).UNSAFE_queryAllByType(Text)).toHaveLength(2)

    const visibleStyle = StyleSheet.flatten(
      screen.getByTestId(SEND_WALLET_LINES_TEST_ID).props.style,
    )
    expect(visibleStyle.position).toBe("absolute")
    expect(visibleStyle.justifyContent).toBe("center")
  })

  describe("surface", () => {
    const cardStyle = () =>
      StyleSheet.flatten(screen.getByTestId("choose-wallet-to-send-from").props.style)

    it("uses the grey7 static surface when it can't switch wallets", () => {
      render(bitcoinCard)

      expect(cardStyle().backgroundColor).toBe(light.grey7)
    })

    it("uses the grey5 surface when it can switch wallets", () => {
      render(
        <ThemeProvider theme={theme}>
          <SendWalletSummary
            currency={WalletCurrency.Btc}
            balancePrimary="741 SAT"
            onSwitch={jest.fn()}
          />
        </ThemeProvider>,
      )

      expect(cardStyle().backgroundColor).toBe(light.grey5)
    })
  })

  describe("hidden balance", () => {
    const hiddenCard = (onReveal?: () => void) => (
      <ThemeProvider theme={theme}>
        <SendWalletSummary
          currency={WalletCurrency.Btc}
          balancePrimary="741 SAT"
          balanceSecondary="~ $0.57"
          isBalanceHidden
          onReveal={onReveal}
        />
      </ThemeProvider>
    )

    it("shows the placeholder instead of both balance lines", () => {
      render(hiddenCard())

      expect(screen.getByTestId("hidden-balance-placeholder")).toBeTruthy()
      expect(screen.queryByTestId(`${WalletCurrency.Btc} Wallet Balance`)).toBeNull()
      expect(screen.queryByTestId(SEND_WALLET_SECONDARY_TEST_ID)).toBeNull()
    })

    it("keeps the balance out of the accessibility label", () => {
      render(hiddenCard())

      expect(
        screen.getByTestId("choose-wallet-to-send-from").props.accessibilityLabel,
      ).toBe("Bitcoin")
    })

    it("calls onReveal when the card is tapped", () => {
      const onReveal = jest.fn()
      render(hiddenCard(onReveal))

      fireEvent.press(screen.getByTestId("choose-wallet-to-send-from"))

      expect(onReveal).toHaveBeenCalledTimes(1)
    })
  })
})
