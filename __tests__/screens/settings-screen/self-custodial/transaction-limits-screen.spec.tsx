import React from "react"
import { render } from "@testing-library/react-native"

import { SelfCustodialTransactionLimitsScreen } from "@app/screens/settings-screen/self-custodial/transaction-limits-screen"

jest.mock("@rn-vui/themed", () => {
  const colors: Record<string, string> = {
    grey2: "#999",
    grey5: "#f5f5f5",
    black: "#000",
    error: "#f00",
  }
  return {
    makeStyles:
      (
        fn: (
          theme: { colors: Record<string, string> },
          params: Record<string, string | undefined>,
        ) => Record<string, object>,
      ) =>
      (params: Record<string, string | undefined> = {}) =>
        fn({ colors }, params),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    useTheme: () => ({ theme: { colors } }),
  }
})

jest.mock("@app/components/screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) =>
    React.createElement("Screen", null, children),
}))

const mockUseLimits = jest.fn()

jest.mock("@app/self-custodial/hooks/use-self-custodial-conversion-limits", () => ({
  useSelfCustodialConversionLimits: () => mockUseLimits(),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      SettingsScreen: {
        TransactionLimits: {
          protocolNote: () => "Protocol note",
          btcToUsdTitle: () => "Bitcoin to Dollars",
          usdToBtcTitle: () => "Dollars to Bitcoin",
          minFromLabel: () => "Minimum sent",
          minToLabel: () => "Minimum received",
          loadError: () => "Could not load conversion limits.",
        },
      },
    },
  }),
}))

describe("SelfCustodialTransactionLimitsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders an error message when the limits hook surfaces an error", () => {
    mockUseLimits.mockReturnValue({
      btcToUsd: null,
      usdToBtc: null,
      loading: false,
      error: new Error("limits unavailable"),
    })

    const { getByTestId, getByText } = render(<SelfCustodialTransactionLimitsScreen />)

    expect(getByTestId("transaction-limits-error")).toBeTruthy()
    expect(getByText("Could not load conversion limits.")).toBeTruthy()
  })

  it("formats sats and cents for both directions when limits load", () => {
    mockUseLimits.mockReturnValue({
      btcToUsd: { minFromAmount: 1500, minToAmount: 50 },
      usdToBtc: { minFromAmount: 25, minToAmount: 200 },
      loading: false,
      error: null,
    })

    const { getByTestId } = render(<SelfCustodialTransactionLimitsScreen />)

    expect(getByTestId("btc-to-usd-min-from").props.children).toBe("1,500 sats")
    expect(getByTestId("btc-to-usd-min-to").props.children).toBe("$0.50")
    expect(getByTestId("usd-to-btc-min-from").props.children).toBe("$0.25")
    expect(getByTestId("usd-to-btc-min-to").props.children).toBe("200 sats")
  })

  it("renders an em-dash placeholder when a limit value is null", () => {
    mockUseLimits.mockReturnValue({
      btcToUsd: { minFromAmount: null, minToAmount: null },
      usdToBtc: { minFromAmount: null, minToAmount: null },
      loading: false,
      error: null,
    })

    const { getByTestId } = render(<SelfCustodialTransactionLimitsScreen />)

    expect(getByTestId("btc-to-usd-min-from").props.children).toBe("—")
    expect(getByTestId("usd-to-btc-min-to").props.children).toBe("—")
  })
})
