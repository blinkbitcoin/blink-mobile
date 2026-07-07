import React from "react"
import { Linking } from "react-native"
import { render, screen, fireEvent } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import {
  MigrationMode,
  MigrationRequiredScreen,
} from "@app/screens/account-migration/to-non-custodial/migration-required-screen"
import { ContextForScreen } from "../../helper"
import { flushEffects } from "../../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const CHECKPOINT_ROUTE = "accountMigrationExplainer"
const KEEP_RECEIVING_ROUTE = "accountMigrationKeepReceiving"
const SUPPORT_EMAIL = "support@blink.sv"

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
const mockUseWalletOverviewScreenQuery = jest.fn()
const mockUseAddressScreenQuery = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useWalletOverviewScreenQuery: () => mockUseWalletOverviewScreenQuery(),
  useAddressScreenQuery: () => mockUseAddressScreenQuery(),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => true,
}))

jest.mock("@app/screens/account-migration/hooks", () => ({
  useMigrationCheckpoint: () => ({ getRouteForCheckpoint: () => CHECKPOINT_ROUTE }),
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

const renderScreen = (mode: MigrationMode, onClose?: () => void) =>
  render(
    <ContextForScreen>
      <MigrationRequiredScreen mode={mode} onClose={onClose} />
    </ContextForScreen>,
  )

describe("MigrationRequiredScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockUseWalletOverviewScreenQuery.mockReturnValue(walletsWithUsdCents(2500))
    mockUseAddressScreenQuery.mockReturnValue({ data: undefined })
    jest.spyOn(Linking, "openURL").mockImplementation(() => Promise.resolve())
  })

  describe("voluntary mode", () => {
    it("renders the upgrade hero, voluntary copy and a close button", async () => {
      renderScreen("voluntary")
      await flushEffects()

      expect(screen.getByTestId("icon-upgrade")).toBeTruthy()
      expect(screen.getByText(LL.AccountMigration.migrationRequiredTitle())).toBeTruthy()
      expect(screen.getByText(LL.AccountMigration.migrationRequiredBody())).toBeTruthy()
      expect(screen.getByTestId("migration-close")).toBeTruthy()
    })

    it("does not show balances", async () => {
      renderScreen("voluntary")
      await flushEffects()

      expect(screen.queryByText(LL.AccountMigration.bitcoinBalance())).toBeNull()
      expect(screen.queryByText(LL.AccountMigration.dollarBalance())).toBeNull()
    })
  })

  describe("forced pre-deadline mode", () => {
    it("renders the upgrade hero, regulatory copy and a close button", async () => {
      renderScreen("forcedPreDeadline")
      await flushEffects()

      expect(screen.getByTestId("icon-upgrade")).toBeTruthy()
      expect(
        screen.getByText(LL.AccountMigration.migrationRequiredForcedBody()),
      ).toBeTruthy()
      expect(screen.getByTestId("migration-close")).toBeTruthy()
    })
  })

  describe("gate mode", () => {
    it("renders the warning hero, gate title, balances and no close button", async () => {
      renderScreen("gate")
      await flushEffects()

      expect(screen.getByTestId("icon-warning")).toBeTruthy()
      expect(screen.getByText(LL.AccountMigration.migrationGateTitle())).toBeTruthy()
      expect(screen.getByText("BTC 1000")).toBeTruthy()
      expect(screen.getByText("USD 2500")).toBeTruthy()
      expect(screen.queryByTestId("migration-close")).toBeNull()
    })

    it("opens the support email when the address link is pressed", async () => {
      renderScreen("gate")
      await flushEffects()

      fireEvent.press(screen.getByText(SUPPORT_EMAIL))

      expect(Linking.openURL).toHaveBeenCalledWith(`mailto:${SUPPORT_EMAIL}`)
    })

    it("falls back to zero balances when wallet data is unavailable", async () => {
      mockUseWalletOverviewScreenQuery.mockReturnValue({ data: undefined })
      renderScreen("gate")
      await flushEffects()

      expect(screen.getByText("BTC 0")).toBeTruthy()
      expect(screen.getByText("USD 0")).toBeTruthy()
    })
  })

  describe("closing", () => {
    it("calls onClose when provided (forced blocker)", async () => {
      const onClose = jest.fn()
      renderScreen("forcedPreDeadline", onClose)
      await flushEffects()

      fireEvent.press(screen.getByTestId("migration-close"))

      expect(onClose).toHaveBeenCalledTimes(1)
      expect(mockGoBack).not.toHaveBeenCalled()
    })

    it("navigates back when no onClose is provided (voluntary route)", async () => {
      renderScreen("voluntary")
      await flushEffects()

      fireEvent.press(screen.getByTestId("migration-close"))

      expect(mockGoBack).toHaveBeenCalledTimes(1)
    })
  })

  describe("continue", () => {
    it("skips straight into the migration flow when there is no lightning address", async () => {
      renderScreen("voluntary")
      await flushEffects()

      fireEvent.press(screen.getByText(LL.common.continue()))

      expect(mockNavigate).toHaveBeenCalledWith(CHECKPOINT_ROUTE)
    })

    it("routes through the keep-receiving screen when the user has a lightning address", async () => {
      mockUseAddressScreenQuery.mockReturnValue({
        data: { me: { username: "satoshin21" } },
      })
      renderScreen("voluntary")
      await flushEffects()

      fireEvent.press(screen.getByText(LL.common.continue()))

      expect(mockNavigate).toHaveBeenCalledWith(KEEP_RECEIVING_ROUTE)
    })
  })
})
