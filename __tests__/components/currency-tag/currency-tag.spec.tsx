import React from "react"
import { StyleSheet } from "react-native"
import { render } from "@testing-library/react-native"

import { CurrencyTag } from "@app/components/currency-tag"
import { WalletCurrency } from "@app/graphql/generated"

/** backgroundDefault and textOnAccent share a value in the real palette, so they get
 *  distinct sentinels here to show which one the label picks. */
jest.mock("@rn-vui/themed", () => {
  const colors = {
    backgroundDefault: "backgroundDefault",
    textOnAccent: "textOnAccent",
    textOnBackground: "textOnBackground",
    accent: "accent",
    staticSuccess: "staticSuccess",
  }
  return {
    makeStyles:
      (fn: (theme: { colors: typeof colors }) => Record<string, object>) => () =>
        fn({ colors }),
    useTheme: () => ({ theme: { colors } }),
  }
})

describe("CurrencyTag", () => {
  it("draws the BTC label in textOnAccent, the role for content on an accent fill", () => {
    const { getByText } = render(<CurrencyTag walletCurrency={WalletCurrency.Btc} />)

    expect(StyleSheet.flatten(getByText("BTC").props.style).color).toBe("textOnAccent")
  })
})
