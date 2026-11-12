import React from "react"
import { StyleSheet, Text } from "react-native"
import { fireEvent, render, screen, within } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import {
  SEND_WALLET_LINES_TEST_ID,
  SEND_WALLET_SECONDARY_TEST_ID,
  SEND_WALLET_SIZER_TEST_ID,
  SEND_WALLET_SUMMARY_TEST_ID,
  WALLET_SUMMARY_LOADER_TEST_ID,
  WalletSummary,
} from "@app/components/wallet-summary"
import { WalletCurrency } from "@app/graphql/generated"
import theme from "@app/rne-theme/theme"

const mockWalletSwitch = jest.fn()
jest.mock("@app/components/wallet-switch", () => ({
  WalletSwitch: (props: unknown) => {
    mockWalletSwitch(props)
    return null
  },
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: {
        bitcoin: () => "Bitcoin",
        dollar: () => "Dollar",
        allAccounts: () => "All accounts",
      },
      Accessibility: {
        switchToWallet: ({ wallet }: { wallet: string }) => `Switch to ${wallet}`,
      },
    },
  }),
}))

const renderCard = (props: Partial<React.ComponentProps<typeof WalletSummary>> = {}) =>
  render(
    <ThemeProvider theme={theme}>
      <WalletSummary currency="ALL" balancePrimary="1,500 SAT" {...props} />
    </ThemeProvider>,
  )

const card = () => screen.getByTestId(SEND_WALLET_SUMMARY_TEST_ID)

beforeEach(() => mockWalletSwitch.mockClear())

describe("WalletSummary", () => {
  describe("All", () => {
    it("shows the combined balance", () => {
      renderCard()

      expect(screen.getByTestId("ALL Wallet Balance").props.children).toBe("1,500 SAT")
    })

    it("names the card All accounts for screen readers, without the balance", () => {
      renderCard()

      expect(card().props.accessibilityLabel).toBe("All accounts")
    })

    it("hands All to the wallet pill", () => {
      renderCard({ onSwitch: () => {} })

      expect(mockWalletSwitch).toHaveBeenLastCalledWith(
        expect.objectContaining({ currency: "ALL", canToggle: true }),
      )
    })
  })

  describe("switching", () => {
    it("calls onSwitch when tapped", () => {
      const onSwitch = jest.fn()
      renderCard({ onSwitch })

      fireEvent.press(card())

      expect(onSwitch).toHaveBeenCalledTimes(1)
    })

    /** A screen reader hears only what a tap selects: no balance, no current wallet. */
    it("reads as Switch to the wallet a tap selects", () => {
      renderCard({ onSwitch: () => {}, switchTo: WalletCurrency.Btc })

      expect(card().props.accessibilityRole).toBe("button")
      expect(card().props.accessibilityLabel).toBe("Switch to Bitcoin")
    })

    it("is a plain read-out with no onSwitch", () => {
      renderCard()

      expect(card().props.accessibilityState).toMatchObject({ disabled: true })
      expect(mockWalletSwitch).toHaveBeenLastCalledWith(
        expect.objectContaining({ canToggle: false }),
      )
    })
  })

  describe("hidden balances", () => {
    it("shows the dots in place of the amounts", () => {
      renderCard({ balanceHidden: true, balanceSecondary: "~ $1.50" })

      expect(screen.getByTestId("hidden-balance-placeholder")).toBeTruthy()
      expect(screen.queryByTestId(SEND_WALLET_LINES_TEST_ID)).toBeNull()
    })

    it("keeps the amount out of the screen-reader label", () => {
      renderCard({ balanceHidden: true })

      expect(card().props.accessibilityLabel).toBe("All accounts")
    })
  })

  describe("loading balances", () => {
    it("shows a loading bar in place of the amounts", () => {
      renderCard({ balancePrimary: "", balanceLoading: true })

      expect(screen.getByTestId(WALLET_SUMMARY_LOADER_TEST_ID)).toBeTruthy()
      expect(screen.queryByTestId(SEND_WALLET_LINES_TEST_ID)).toBeNull()
    })

    it("keeps the dots when balances are hidden", () => {
      renderCard({ balancePrimary: "", balanceLoading: true, balanceHidden: true })

      expect(screen.getByTestId("hidden-balance-placeholder")).toBeTruthy()
      expect(screen.queryByTestId(WALLET_SUMMARY_LOADER_TEST_ID)).toBeNull()
    })
  })

  /** How the transaction details show it: a settled read-out, not a control. */
  describe("as a read-out", () => {
    it("shows the display-currency value under the balance when there is one", () => {
      renderCard({
        inactive: true,
        currency: WalletCurrency.Btc,
        balancePrimary: "741 SAT",
        balanceSecondary: "~ $0.57",
      })

      expect(screen.getByTestId(SEND_WALLET_SECONDARY_TEST_ID)).toBeTruthy()
    })

    it("shows a single line when there is no second denomination", () => {
      renderCard({
        inactive: true,
        currency: WalletCurrency.Usd,
        balancePrimary: "$0.57",
      })

      expect(screen.queryByTestId(SEND_WALLET_SECONDARY_TEST_ID)).toBeNull()
    })

    /** The single line sits in the middle of a card as tall as the two-line one. */
    it("keeps the two-line height with a hidden copy", () => {
      renderCard({
        inactive: true,
        currency: WalletCurrency.Usd,
        balancePrimary: "$0.57",
      })

      const hiddenCopy = screen.getByTestId(SEND_WALLET_SIZER_TEST_ID, {
        includeHiddenElements: true,
      })
      expect(StyleSheet.flatten(hiddenCopy.props.style).opacity).toBe(0)
      expect(within(hiddenCopy).UNSAFE_queryAllByType(Text)).toHaveLength(2)
    })

    it("names only the wallet, drops the swap icon and sits on grey7", () => {
      renderCard({
        inactive: true,
        currency: WalletCurrency.Btc,
        balancePrimary: "741 SAT",
      })

      expect(card().props.accessibilityLabel).toBe("Bitcoin")
      expect(card().props.accessibilityRole).toBeUndefined()
      expect(mockWalletSwitch).toHaveBeenLastCalledWith(
        expect.objectContaining({ hasSwapIcon: false }),
      )
      expect(StyleSheet.flatten(card().props.style).backgroundColor).toBe(
        theme.lightColors?.surfaceStatic,
      )
    })
  })
})
