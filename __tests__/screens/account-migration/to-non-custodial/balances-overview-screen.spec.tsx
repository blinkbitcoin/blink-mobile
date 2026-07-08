import React from "react"
import { Linking } from "react-native"
import { render, screen, fireEvent } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { MigrationBalancesOverviewScreen } from "@app/screens/account-migration/to-non-custodial/balances-overview-screen"
import { ContextForScreen } from "../../helper"
import { flushEffects } from "../../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")
const LLOverview = LL.AccountMigration.balancesOverview
const CONTACT_EMAIL = "feedback@blink.sv"

const mockNavigate = jest.fn()
const mockUseWalletOverviewScreenQuery = jest.fn()
let mockDollarRestricted = false
let mockConvertReady = true
let mockRouteParams: { isPostGate?: boolean } | undefined

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: mockRouteParams }),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useWalletOverviewScreenQuery: () => mockUseWalletOverviewScreenQuery(),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => true,
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ feedbackEmailAddress: "feedback@blink.sv" }),
}))

jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceRestricted: () => mockDollarRestricted,
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({
      moneyAmount,
    }: {
      moneyAmount: { amount: number; currency: string }
    }) => `${moneyAmount.currency} ${moneyAmount.amount}`,
    moneyAmountToDisplayCurrencyString: ({
      isApproximate,
    }: {
      isApproximate?: boolean
    }) => (mockConvertReady ? `${isApproximate ? "~ " : ""}$FIAT` : undefined),
  }),
}))

const walletsWithBalances = ({ sats, usdCents }: { sats: number; usdCents: number }) => ({
  data: {
    me: {
      defaultAccount: {
        wallets: [
          { __typename: "BTCWallet", id: "btc-1", walletCurrency: "BTC", balance: sats },
          {
            __typename: "USDWallet",
            id: "usd-1",
            walletCurrency: "USD",
            balance: usdCents,
          },
        ],
      },
    },
  },
})

const renderScreen = () =>
  render(
    <ContextForScreen>
      <MigrationBalancesOverviewScreen />
    </ContextForScreen>,
  )

describe("MigrationBalancesOverviewScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockDollarRestricted = false
    mockConvertReady = true
    mockRouteParams = undefined
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletsWithBalances({ sats: 1000, usdCents: 0 }),
    )
    jest.spyOn(Linking, "openURL").mockImplementation(() => Promise.resolve())
  })

  it("renders the hero, both balance cards, fee and actions without an exchange rate", async () => {
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("icon-send")).toBeTruthy()
    expect(screen.getByText(LLOverview.title())).toBeTruthy()
    expect(screen.getByText(LLOverview.body())).toBeTruthy()
    expect(screen.getByText(LLOverview.currentBitcoinBalance())).toBeTruthy()
    expect(screen.getByText(LLOverview.newBitcoinBalance())).toBeTruthy()
    // Current and new bitcoin: sats value + fiat suffix (fee is zero, so they match).
    expect(screen.getAllByText("BTC 1000 ($FIAT)")).toHaveLength(2)
    expect(screen.getByText(/Network fee:/)).toBeTruthy()
    // The voluntary flow never quotes a rate; only the post-gate variant does.
    expect(screen.queryByText(/Current exchange rate/)).toBeNull()
    expect(screen.getByText(LLOverview.approveCta())).toBeTruthy()
    expect(screen.getByText(LLOverview.contactSupportCta())).toBeTruthy()
  })

  it("shows the exchange rate only on the post-gate variant", async () => {
    mockRouteParams = { isPostGate: true }
    renderScreen()
    await flushEffects()

    expect(screen.getByText(/Current exchange rate/)).toBeTruthy()
  })

  it("commits to the transfer when Approve is pressed", async () => {
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LLOverview.approveCta()))

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationTransferringFunds")
  })

  it("opens the support email when Contact support is pressed", async () => {
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LLOverview.contactSupportCta()))

    expect(Linking.openURL).toHaveBeenCalledWith(`mailto:${CONTACT_EMAIL}`)
  })

  it("shows a zero new dollar balance when self-custodial dollars are available", async () => {
    renderScreen()
    await flushEffects()

    expect(screen.queryByText(LLOverview.dollarBalanceNotAvailable())).toBeNull()
    // Current and new dollar balances both read $0.00 via the mocked formatter.
    expect(screen.getAllByText("USD 0")).toHaveLength(2)
  })

  it("shows 'not available' for the new dollar balance when self-custodial dollars are restricted", async () => {
    mockDollarRestricted = true
    renderScreen()
    await flushEffects()

    expect(screen.getByText(LLOverview.dollarBalanceNotAvailable())).toBeTruthy()
    // Only the current dollar balance keeps a value.
    expect(screen.getAllByText("USD 0")).toHaveLength(1)
  })

  it("falls back to zero balances when wallet data is unavailable", async () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({ data: undefined })
    renderScreen()
    await flushEffects()

    expect(screen.getAllByText("BTC 0 ($FIAT)")).toHaveLength(2)
  })

  it("hides the fiat suffix when price conversion is unavailable", async () => {
    mockConvertReady = false
    renderScreen()
    await flushEffects()

    expect(screen.getAllByText("BTC 1000")).toHaveLength(2)
  })

  it("hides the exchange rate on the post-gate variant when conversion is unavailable", async () => {
    mockRouteParams = { isPostGate: true }
    mockConvertReady = false
    renderScreen()
    await flushEffects()

    expect(screen.queryByText(/Current exchange rate/)).toBeNull()
  })
})
