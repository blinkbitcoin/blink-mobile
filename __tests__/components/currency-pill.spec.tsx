import * as React from "react"
import { Text as ReactNativeText } from "react-native"
import { render } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { CurrencyPill } from "@app/components/atomic/currency-pill"

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: {
        bitcoin: () => "Bitcoin",
        dollar: () => "Dollar",
        all: () => "All",
      },
    },
  }),
}))

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
          grey1: "grey1",
          grey3: "grey3",
          transparent: "transparent",
        },
      },
    }),
    makeStyles: () => () => ({
      container: {},
      text: {},
      outlinedContainer: {},
      outlinedText: {},
    }),
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

    expect(getByText("Bitcoin")).toBeTruthy()
    expect(getByText("Dollar")).toBeTruthy()
  })

  it("renders custom label for ALL", () => {
    const { getByText } = render(<CurrencyPill currency={"ALL"} label="Todos" />)

    expect(getByText("Todos")).toBeTruthy()
  })

  it("outlined variant renders with custom label", () => {
    const { getByText } = render(<CurrencyPill variant="outlined" label="USD" />)

    expect(getByText("USD")).toBeTruthy()
  })

  it("outlined variant renders without currency prop", () => {
    const { getByText } = render(<CurrencyPill variant="outlined" label="SAT" />)

    expect(getByText("SAT")).toBeTruthy()
  })

  it("outlined variant with BTC currency but label overrides", () => {
    const { getByText, queryByText } = render(
      <CurrencyPill currency={WalletCurrency.Btc} variant="outlined" label="Custom" />,
    )

    expect(getByText("Custom")).toBeTruthy()
    expect(queryByText("Bitcoin")).toBeNull()
  })

  it("outlined variant with no label renders empty text", () => {
    const { getByText } = render(<CurrencyPill variant="outlined" />)

    expect(getByText("")).toBeTruthy()
  })
})
