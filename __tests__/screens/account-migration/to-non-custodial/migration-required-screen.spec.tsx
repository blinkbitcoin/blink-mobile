import React from "react"
import { render, screen, fireEvent } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { MigrationRequiredScreen } from "@app/screens/account-migration/to-non-custodial/migration-required-screen"
import { ContextForScreen } from "../../helper"
import { flushEffects } from "../../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const MIGRATION_ROUTE = "accountMigrationExplainer"

const mockNavigate = jest.fn()
const mockUseWalletOverviewScreenQuery = jest.fn()

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

jest.mock("@app/screens/account-migration/hooks", () => ({
  useMigrationCheckpoint: () => ({ getRouteForCheckpoint: () => MIGRATION_ROUTE }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({
      moneyAmount,
    }: {
      moneyAmount: { amount: number; currency: string }
    }) => `${moneyAmount.currency} ${moneyAmount.amount}`,
  }),
}))

const walletsWithUsdCents = (usdBalanceCents: number) => ({
  data: {
    me: {
      defaultAccount: {
        wallets: [
          { __typename: "BTCWallet", id: "btc-1", walletCurrency: "BTC", balance: 1000 },
          {
            __typename: "USDWallet",
            id: "usd-1",
            walletCurrency: "USD",
            balance: usdBalanceCents,
          },
        ],
      },
    },
  },
})

const renderScreen = () =>
  render(
    <ContextForScreen>
      <MigrationRequiredScreen />
    </ContextForScreen>,
  )

describe("MigrationRequiredScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockUseWalletOverviewScreenQuery.mockReturnValue(walletsWithUsdCents(0))
  })

  it("renders the upgrade hero icon, title and body", async () => {
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("icon-caret-up-circle")).toBeTruthy()
    expect(screen.getByText(LL.AccountMigration.migrationRequiredTitle())).toBeTruthy()
    expect(screen.getByText(LL.AccountMigration.migrationRequiredBody())).toBeTruthy()
  })

  it("renders the bitcoin and dollar balances", async () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue(walletsWithUsdCents(2500))
    renderScreen()
    await flushEffects()

    expect(screen.getByText("BTC 1000")).toBeTruthy()
    expect(screen.getByText("USD 2500")).toBeTruthy()
  })

  it("warns when the dollar balance is below the transferable minimum", async () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue(walletsWithUsdCents(10))
    renderScreen()
    await flushEffects()

    expect(
      screen.getByText(LL.AccountMigration.migrationRequiredSmallBalanceWarning()),
    ).toBeTruthy()
  })

  it("does not warn when the dollar balance is zero", async () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue(walletsWithUsdCents(0))
    renderScreen()
    await flushEffects()

    expect(
      screen.queryByText(LL.AccountMigration.migrationRequiredSmallBalanceWarning()),
    ).toBeNull()
  })

  it("does not warn when the dollar balance is at or above the minimum", async () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue(walletsWithUsdCents(50))
    renderScreen()
    await flushEffects()

    expect(
      screen.queryByText(LL.AccountMigration.migrationRequiredSmallBalanceWarning()),
    ).toBeNull()
  })

  it("sends the user into the migration flow when Continue is pressed", async () => {
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LL.common.continue()))

    expect(mockNavigate).toHaveBeenCalledWith(MIGRATION_ROUTE)
  })
})
