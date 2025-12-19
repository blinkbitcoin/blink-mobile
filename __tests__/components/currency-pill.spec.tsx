import * as React from "react"
import { Text as ReactNativeText } from "react-native"
import { render } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { CurrencyPill } from "@app/components/atomic/currency-pill"

jest.mock("@rn-vui/themed", () => {
  return {
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
          transparent: "transparent",
        },
      },
    }),
    makeStyles: () => () => ({ container: {}, text: {} }),
  }
})

describe("CurrencyPill", () => {
  it("renders BTC and USD labels by default", () => {
    const { getByText } = render(
      <>
        <CurrencyPill currency={WalletCurrency.Btc} />
        <CurrencyPill currency={WalletCurrency.Usd} />
      </>,
    )

    expect(getByText("BTC")).toBeTruthy()
    expect(getByText("USD")).toBeTruthy()
  })

  it("renders custom label for ALL", () => {
    const { getByText } = render(<CurrencyPill currency={"ALL"} label="Todos" />)

    expect(getByText("Todos")).toBeTruthy()
  })
})
