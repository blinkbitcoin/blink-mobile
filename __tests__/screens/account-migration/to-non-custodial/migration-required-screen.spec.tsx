import React from "react"
import { Linking } from "react-native"
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import {
  MigrationMode,
  MigrationRequiredScreen,
} from "@app/screens/account-migration/to-non-custodial/migration-required-screen"
import { ContextForScreen } from "../../helper"
import { walletOverviewQueryResult } from "../helpers"
import { flushEffects } from "../../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const KEEP_RECEIVING_ROUTE = "accountMigrationKeepReceiving"
const CONTACT_EMAIL = "support@blink.sv"

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

jest.mock("@app/config/feature-flags-context", () => ({
  ...jest.requireActual("@app/config/feature-flags-context"),
  useRemoteConfig: () => ({ supportEmailAddress: "support@blink.sv" }),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => true,
}))

const mockGoToNextStep = jest.fn()
let mockNextStepLoading = false

jest.mock("@app/screens/account-migration/hooks", () => ({
  ...jest.requireActual("@app/screens/account-migration/hooks"),
  useMigrationNextStep: () => ({
    goToNextStep: mockGoToNextStep,
    replaceToCheckpoint: jest.fn(),
    loading: mockNextStepLoading,
  }),
}))

let mockConvertReady = true
const mockConvert = (moneyAmount: { amount: number; currency: string }) => moneyAmount

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({
      moneyAmount,
    }: {
      moneyAmount: { amount: number; currency: string }
    }) => `${moneyAmount.currency} ${moneyAmount.amount}`,
    formatDisplayAndWalletAmount: ({
      walletAmount,
    }: {
      walletAmount: { amount: number; currency: string }
    }) => `${walletAmount.currency} ${walletAmount.amount} (display)`,
  }),
}))

jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => ({
    convertMoneyAmount: mockConvertReady ? mockConvert : undefined,
  }),
}))

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
    mockConvertReady = true
    mockNextStepLoading = false
    mockUseWalletOverviewScreenQuery.mockReturnValue(
      walletOverviewQueryResult({ btcBalance: 1000, usdBalance: 2500 }),
    )
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
      expect(screen.getByText("BTC 1000 (display)")).toBeTruthy()
      expect(screen.getByText("USD 2500")).toBeTruthy()
      expect(screen.queryByTestId("migration-close")).toBeNull()
    })

    it("opens the support email when the address link is pressed", async () => {
      renderScreen("gate")
      await flushEffects()

      fireEvent.press(screen.getByText(CONTACT_EMAIL))

      await waitFor(() =>
        expect(Linking.openURL).toHaveBeenCalledWith(`mailto:${CONTACT_EMAIL}`),
      )
    })

    it("hides the balance rows when wallet data is unavailable", async () => {
      mockUseWalletOverviewScreenQuery.mockReturnValue({ data: undefined })
      renderScreen("gate")
      await flushEffects()

      expect(screen.queryByText("BTC 0 (display)")).toBeNull()
      expect(screen.queryByText("USD 0")).toBeNull()
    })

    it("hides the balance rows while the wallet query loads", async () => {
      mockUseWalletOverviewScreenQuery.mockReturnValue({ data: undefined, loading: true })
      renderScreen("gate")
      await flushEffects()

      expect(screen.queryByText("Bitcoin balance")).toBeNull()
      expect(screen.queryByText("Dollar balance")).toBeNull()
    })

    it("shows the plain bitcoin balance when price conversion is unavailable", async () => {
      mockConvertReady = false
      renderScreen("gate")
      await flushEffects()

      expect(screen.getByText("BTC 1000")).toBeTruthy()
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
    it("hands off to the flow's next step when there is no lightning address", async () => {
      renderScreen("voluntary")
      await flushEffects()

      fireEvent.press(screen.getByText(LL.common.continue()))

      expect(mockGoToNextStep).toHaveBeenCalledTimes(1)
      expect(mockNavigate).not.toHaveBeenCalledWith(KEEP_RECEIVING_ROUTE)
    })

    it("routes through the keep-receiving screen when the user has a lightning address", async () => {
      mockUseAddressScreenQuery.mockReturnValue({
        data: { me: { username: "satoshin21" } },
      })
      renderScreen("voluntary")
      await flushEffects()

      fireEvent.press(screen.getByText(LL.common.continue()))

      expect(mockNavigate).toHaveBeenCalledWith(KEEP_RECEIVING_ROUTE)
      expect(mockGoToNextStep).not.toHaveBeenCalled()
    })

    it("marks the CTA as loading while the next-step checks load", async () => {
      mockNextStepLoading = true
      renderScreen("voluntary")
      await flushEffects()

      expect(
        screen.getByTestId("migration-required-cta").props.accessibilityState?.busy,
      ).toBe(true)
    })

    it("holds the CTA until the lightning-address query settles, so a fast tap can't misroute", async () => {
      mockUseAddressScreenQuery.mockReturnValue({ data: undefined, loading: true })
      renderScreen("voluntary")
      await flushEffects()

      expect(
        screen.getByTestId("migration-required-cta").props.accessibilityState?.busy,
      ).toBe(true)
    })
  })
})
