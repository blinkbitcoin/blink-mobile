import React from "react"
import { Linking } from "react-native"
import { render, screen, fireEvent } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { MigrationCheckpoint } from "@app/screens/account-migration/hooks"
import { MigrationBalancesOverviewScreen } from "@app/screens/account-migration/to-non-custodial/balances-overview-screen"
import { ContextForScreen } from "../../helper"
import { flushEffects } from "../../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")
const LLOverview = LL.AccountMigration.balancesOverview
const CONTACT_EMAIL = "support@blink.sv"

const mockNavigate = jest.fn()
const mockUseWalletOverviewScreenQuery = jest.fn()
let mockDollarRestricted = false
let mockCurrentDollarRestricted = false
let mockConvertReady = true
let mockGateArmed = false

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useWalletOverviewScreenQuery: () => mockUseWalletOverviewScreenQuery(),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => true,
}))

const mockSaveCheckpoint = jest.fn()
let mockCheckpointLoading = false

jest.mock("@app/screens/account-migration/hooks", () => ({
  ...jest.requireActual("@app/screens/account-migration/hooks"),
  useMigrationCheckpoint: () => ({
    loading: mockCheckpointLoading,
    saveCheckpoint: mockSaveCheckpoint,
  }),
  useMigrationGateArmed: () => mockGateArmed,
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ supportEmailAddress: "support@blink.sv" }),
}))

jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceRestricted: (accountType: string) =>
    accountType === "custodial" ? mockCurrentDollarRestricted : mockDollarRestricted,
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
    mockCurrentDollarRestricted = false
    mockConvertReady = true
    mockCheckpointLoading = false
    mockGateArmed = false
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
    // The server preview mocks the 10-sat network fee: new = receiveSats, never
    // client arithmetic.
    expect(screen.getByText("BTC 1000 ($FIAT)")).toBeTruthy()
    expect(screen.getByText("BTC 990 ($FIAT)")).toBeTruthy()
    expect(screen.getByText(/Network fee:/)).toBeTruthy()
    expect(screen.queryByText(/covered by Blink/)).toBeNull()
    // The voluntary flow never quotes a rate; only the post-gate variant does.
    expect(screen.queryByText(/Current exchange rate/)).toBeNull()
    expect(screen.getByText(LLOverview.approveCta())).toBeTruthy()
    expect(screen.getByText(LLOverview.contactSupportCta())).toBeTruthy()
  })

  it("marks the fee as covered by Blink for a de-minimis balance", async () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletsWithBalances({ sats: 80, usdCents: 0 }),
    )
    renderScreen()
    await flushEffects()

    // Blink covers the fee below the de-minimis threshold: the whole balance moves.
    expect(screen.getAllByText("BTC 80 ($FIAT)")).toHaveLength(2)
    expect(screen.getByText(/covered by Blink/)).toBeTruthy()
  })

  it("shows the exchange rate only on the post-gate variant", async () => {
    mockGateArmed = true
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

  it("swallows the hardware back at the commit point", async () => {
    const { BackHandler } =
      jest.requireActual<typeof import("react-native")>("react-native")
    const addListenerSpy = jest.spyOn(BackHandler, "addEventListener")
    renderScreen()
    await flushEffects()

    const handler = addListenerSpy.mock.calls[0][1] as () => boolean

    expect(handler()).toBe(true)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("persists the commit-point checkpoint on landing", async () => {
    renderScreen()
    await flushEffects()

    expect(mockSaveCheckpoint).toHaveBeenCalledWith(MigrationCheckpoint.BalancesOverview)
  })

  it("waits for the checkpoint to load before persisting the commit point", async () => {
    mockCheckpointLoading = true
    renderScreen()
    await flushEffects()

    expect(mockSaveCheckpoint).not.toHaveBeenCalled()
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

  it("shows 'not available' for the current dollar balance under the custodial restriction", async () => {
    mockCurrentDollarRestricted = true
    renderScreen()
    await flushEffects()

    // Never zero, never blank: the restricted current row hides the amount while
    // the unrestricted new row keeps its zero.
    expect(screen.getByText(LLOverview.dollarBalanceNotAvailable())).toBeTruthy()
    expect(screen.getAllByText("USD 0")).toHaveLength(1)
  })

  it("shows 'not available' on both dollar rows in a fully restricted region", async () => {
    mockCurrentDollarRestricted = true
    mockDollarRestricted = true
    renderScreen()
    await flushEffects()

    expect(screen.getAllByText(LLOverview.dollarBalanceNotAvailable())).toHaveLength(2)
    expect(screen.queryByText("USD 0")).toBeNull()
  })

  it("holds a spinner with Approve disabled when wallet data is unavailable", async () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({ data: undefined })
    renderScreen()
    await flushEffects()

    expect(screen.queryByText("Current Bitcoin Balance")).toBeNull()
    expect(screen.getByTestId("migration-balances-overview-loading")).toBeTruthy()
    expect(
      screen.getByTestId("migration-balances-overview-approve"),
    ).toBeDisabled()
  })

  it("holds a spinner with Approve disabled while the wallet query loads", async () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({ data: undefined, loading: true })
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("migration-balances-overview-loading")).toBeTruthy()
    expect(
      screen.getByTestId("migration-balances-overview-approve"),
    ).toBeDisabled()
  })

  it("holds a spinner with Approve disabled when the wallet query fails", async () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      data: undefined,
      error: new Error("network"),
    })
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("migration-balances-overview-loading")).toBeTruthy()
    expect(
      screen.getByTestId("migration-balances-overview-approve"),
    ).toBeDisabled()
  })

  it("hides the fiat suffix when price conversion is unavailable", async () => {
    mockConvertReady = false
    renderScreen()
    await flushEffects()

    expect(screen.getByText("BTC 1000")).toBeTruthy()
    expect(screen.getByText("BTC 990")).toBeTruthy()
  })

  it("hides the exchange rate on the post-gate variant when conversion is unavailable", async () => {
    mockGateArmed = true
    mockConvertReady = false
    renderScreen()
    await flushEffects()

    expect(screen.queryByText(/Current exchange rate/)).toBeNull()
  })
})
