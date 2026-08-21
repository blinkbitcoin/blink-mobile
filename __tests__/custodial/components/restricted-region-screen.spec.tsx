import React from "react"
import { Linking } from "react-native"

import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"
import theme from "@app/rne-theme/theme"
import TypesafeI18n from "@app/i18n/i18n-react"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

const mockUseWalletOverviewScreenQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  useWalletOverviewScreenQuery: (...args: unknown[]) =>
    mockUseWalletOverviewScreenQuery(...args),
  WalletCurrency: { Btc: "BTC", Usd: "USD" },
}))

let mockIsAuthed = true
jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockIsAuthed,
}))

let mockBtcFiat: string | undefined = "$22.42"
jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: () => "21,493 sats",
    moneyAmountToDisplayCurrencyString: ({
      moneyAmount,
    }: {
      moneyAmount: { currency: string }
    }) => (moneyAmount.currency === "BTC" ? mockBtcFiat : "$0.20"),
  }),
}))

const mockOpenSupport = jest.fn()
jest.mock("@app/hooks/use-contact-support", () => ({
  useContactSupport: () => ({ openSupport: mockOpenSupport }),
}))

import { BLOCKED_COUNTRIES_FAQ_LINK } from "@app/config"
import { RestrictedRegionScreen } from "@app/custodial/components/restricted-region-screen"

loadLocale("en")
const LL = i18nObject("en")

const walletsData = {
  me: {
    defaultAccount: {
      wallets: [
        { id: "btc-1", walletCurrency: "BTC", balance: 21493 },
        { id: "usd-1", walletCurrency: "USD", balance: 20 },
      ],
    },
  },
}

const renderScreen = () =>
  render(
    <ThemeProvider theme={theme}>
      <TypesafeI18n locale="en">
        <RestrictedRegionScreen />
      </TypesafeI18n>
    </ThemeProvider>,
  )

describe("RestrictedRegionScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAuthed = true
    mockBtcFiat = "$22.42"
    mockUseWalletOverviewScreenQuery.mockReturnValue({ data: walletsData })
  })

  it("shows the fixed copy with both balances", () => {
    const { getByText } = renderScreen()

    expect(getByText(LL.RestrictedRegion.title())).toBeTruthy()
    expect(
      getByText(`${LL.RestrictedRegion.body()}\n\n${LL.RestrictedRegion.bodyReturn()}`),
    ).toBeTruthy()
    expect(getByText(LL.common.btcAccount())).toBeTruthy()
    expect(getByText("21,493 sats ($22.42)")).toBeTruthy()
    expect(getByText(LL.common.usdAccount())).toBeTruthy()
    expect(getByText("$0.20")).toBeTruthy()
  })

  it("renders the native sat amount bold and the fiat conversion plain", () => {
    const { getByText } = renderScreen()

    expect(getByText("21,493 sats")).toHaveStyle({ fontWeight: "700" })
    expect(getByText("($22.42)")).toHaveStyle({ fontWeight: "400" })
    expect(getByText("$0.20")).toHaveStyle({ fontWeight: "700" })
  })

  it("renders the bitcoin balance without parentheses when no fiat resolves", () => {
    mockBtcFiat = undefined

    const { getByText } = renderScreen()

    expect(getByText("21,493 sats")).toBeTruthy()
  })

  it("hosts a native modal that swallows the Android back press", () => {
    const { getByTestId } = renderScreen()

    const host = getByTestId("restricted-region-screen-host")
    expect(() => host.props.onRequestClose()).not.toThrow()
  })

  it("opens the support inbox on Contact support", () => {
    const { getByTestId } = renderScreen()

    fireEvent.press(getByTestId("restricted-region-contact-support"))

    expect(mockOpenSupport).toHaveBeenCalledTimes(1)
  })

  it("opens the explanation link on Learn more", () => {
    const openUrlSpy = jest
      .spyOn(Linking, "openURL")
      .mockResolvedValue(undefined as never)
    const { getByText } = renderScreen()

    fireEvent.press(getByText(LL.RestrictedRegion.learnMore()))

    expect(openUrlSpy).toHaveBeenCalledWith(BLOCKED_COUNTRIES_FAQ_LINK)
  })

  it("skips the balances query and hides the rows when unauthenticated", () => {
    mockIsAuthed = false
    mockUseWalletOverviewScreenQuery.mockReturnValue({ data: undefined })

    const { queryByText } = renderScreen()

    expect(mockUseWalletOverviewScreenQuery).toHaveBeenCalledWith({ skip: true })
    expect(queryByText(LL.common.btcAccount())).toBeNull()
  })

  it("hides the balance rows when one wallet is missing", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      data: {
        me: {
          defaultAccount: {
            wallets: [{ id: "btc-1", walletCurrency: "BTC", balance: 21493 }],
          },
        },
      },
    })

    const { queryByText } = renderScreen()

    expect(queryByText(LL.common.btcAccount())).toBeNull()
  })

  it("hides the balance rows while the query has no data yet", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({ data: undefined })

    const { queryByText, getByText } = renderScreen()

    expect(getByText(LL.RestrictedRegion.title())).toBeTruthy()
    expect(queryByText(LL.common.btcAccount())).toBeNull()
    expect(queryByText(LL.common.usdAccount())).toBeNull()
  })
})
