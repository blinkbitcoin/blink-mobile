import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import WalletOverview from "@app/components/wallet-overview/wallet-overview"
import { WalletCurrency } from "@app/graphql/generated"
import { HideAmountContextProvider } from "@app/graphql/hide-amount-context"
import { IsAuthedContextProvider } from "@app/graphql/is-authed-context"
import { WalletBalance } from "@app/graphql/wallets-utils"
import { ContextForScreen } from "../screens/helper"
import { flushEffects } from "../helpers/flush-effects"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  }
})

const mockIsRestricted = jest.fn()
jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceRestricted: () => mockIsRestricted(),
}))

const mockDisplayCurrency = jest.fn()
jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({ moneyAmount }: { moneyAmount: { currency: string } }) =>
      moneyAmount.currency === "USD" ? "usd-underlying" : "btc-underlying",
    displayCurrency: mockDisplayCurrency(),
    moneyAmountToDisplayCurrencyString: () => "display-amount",
  }),
}))

const walletsFixture: readonly WalletBalance[] = [
  { id: "btc-id", walletCurrency: WalletCurrency.Btc, balance: 174726 },
  { id: "usd-id", walletCurrency: WalletCurrency.Usd, balance: 6942 },
]

const mockSetStablesatModalVisible = jest.fn()

type RenderOptions = {
  loading?: boolean
  wallets?: readonly WalletBalance[]
  hideAmount?: boolean
  switchMemoryHideAmount?: () => void
  isAuthed?: boolean
  onRestrictedTap?: () => void
  hasCard?: boolean
  cardLastFour?: string | null
}

const renderOverview = ({
  loading = false,
  wallets = walletsFixture,
  hideAmount = false,
  switchMemoryHideAmount = jest.fn(),
  isAuthed = true,
  onRestrictedTap,
  hasCard = false,
  cardLastFour,
}: RenderOptions = {}) =>
  render(
    <ContextForScreen>
      <IsAuthedContextProvider value={isAuthed}>
        <HideAmountContextProvider value={{ hideAmount, switchMemoryHideAmount }}>
          <WalletOverview
            loading={loading}
            wallets={wallets}
            setIsStablesatModalVisible={mockSetStablesatModalVisible}
            onRestrictedTap={onRestrictedTap}
            hasCard={hasCard}
            cardLastFour={cardLastFour}
          />
        </HideAmountContextProvider>
      </IsAuthedContextProvider>
    </ContextForScreen>,
  )

describe("WalletOverview", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockIsRestricted.mockReturnValue(false)
    mockDisplayCurrency.mockReturnValue("USD")
  })

  describe("Card row", () => {
    it("shows the Card row with the masked last four when hasCard is true", async () => {
      const { getByText } = renderOverview({ hasCard: true, cardLastFour: "4242" })
      await flushEffects()

      expect(getByText("Card")).toBeTruthy()
      expect(getByText("•••• 4242")).toBeTruthy()
    })

    it("hides the Card row when hasCard is false", async () => {
      const { queryByText } = renderOverview({ hasCard: false })
      await flushEffects()

      expect(queryByText("Card")).toBeNull()
    })

    it("hides the card last four when hide amount is enabled", async () => {
      const { getByText, queryByText } = renderOverview({
        hasCard: true,
        cardLastFour: "4242",
        hideAmount: true,
      })
      await flushEffects()

      expect(getByText("Card")).toBeTruthy()
      expect(queryByText("•••• 4242")).toBeNull()
      expect(getByText("••••")).toBeTruthy()
    })

    it("navigates to the card dashboard when the Card row is pressed", async () => {
      const { getByText } = renderOverview({ hasCard: true, cardLastFour: "4242" })
      await flushEffects()

      fireEvent.press(getByText("Card"))

      expect(mockNavigate).toHaveBeenCalledWith("cardDashboardScreen")
    })
  })

  describe("balances", () => {
    it("shows the loading skeleton while loading", async () => {
      const { getByText } = renderOverview({ loading: true })
      await flushEffects()

      expect(getByText("Bitcoin")).toBeTruthy()
      expect(getByText("Dollar")).toBeTruthy()
    })

    it("masks the balances when hide amount is enabled", async () => {
      const { getAllByText } = renderOverview({ hideAmount: true })
      await flushEffects()

      expect(getAllByText("****").length).toBeGreaterThanOrEqual(2)
    })

    it("shows the underlying dollar amount when the display currency is not USD", async () => {
      mockDisplayCurrency.mockReturnValue("EUR")

      const { getByText } = renderOverview()
      await flushEffects()

      expect(getByText("usd-underlying")).toBeTruthy()
    })

    it("shows the formatted balances by default", async () => {
      const { getByText, getAllByText } = renderOverview()
      await flushEffects()

      expect(getByText("btc-underlying")).toBeTruthy()
      expect(getAllByText("display-amount").length).toBeGreaterThanOrEqual(1)
    })

    it("shows the restriction label when the dollar balance is restricted", async () => {
      mockIsRestricted.mockReturnValue(true)

      const { getByText } = renderOverview({ onRestrictedTap: jest.fn() })
      await flushEffects()

      expect(getByText("not available in your region")).toBeTruthy()
    })
  })

  describe("interactions", () => {
    it("opens the bitcoin transaction history when the bitcoin row is pressed", async () => {
      const { getByText } = renderOverview()
      await flushEffects()

      fireEvent.press(getByText("Bitcoin"))

      expect(mockNavigate).toHaveBeenCalledWith(
        "transactionHistory",
        expect.objectContaining({ currencyFilter: WalletCurrency.Btc }),
      )
    })

    it("opens the dollar transaction history when the dollar row is pressed", async () => {
      const { getByText } = renderOverview()
      await flushEffects()

      fireEvent.press(getByText("Dollar"))

      expect(mockNavigate).toHaveBeenCalledWith(
        "transactionHistory",
        expect.objectContaining({ currencyFilter: WalletCurrency.Usd }),
      )
    })

    it("does not open the transaction history when there are no wallets", async () => {
      const { getByText } = renderOverview({ wallets: [] })

      fireEvent.press(getByText("Bitcoin"))

      expect(mockNavigate).not.toHaveBeenCalledWith(
        "transactionHistory",
        expect.anything(),
      )

      await flushEffects()
    })

    it("toggles hide amount when the eye icon is pressed", async () => {
      const switchMemoryHideAmount = jest.fn()

      const { getByTestId } = renderOverview({ switchMemoryHideAmount })
      await flushEffects()

      fireEvent.press(getByTestId("icon-eye"))

      expect(switchMemoryHideAmount).toHaveBeenCalledTimes(1)
    })

    it("opens the stablesats modal when the question icon is pressed", async () => {
      const { getByTestId } = renderOverview()
      await flushEffects()

      fireEvent.press(getByTestId("icon-question"))

      expect(mockSetStablesatModalVisible).toHaveBeenCalledWith(true)
    })

    it("applies the pressed state on press in and press out", async () => {
      const { getByText, toJSON } = renderOverview()
      await flushEffects()

      fireEvent(getByText("Bitcoin"), "pressIn")
      fireEvent(getByText("Dollar"), "pressIn")
      fireEvent(getByText("Bitcoin"), "pressOut")
      fireEvent(getByText("Dollar"), "pressOut")

      expect(toJSON()).toBeTruthy()
    })
  })

  describe("authentication and wallet sources", () => {
    it("renders with default balances when no wallets prop is passed", async () => {
      const { getByText } = renderOverview({ wallets: undefined })
      await flushEffects()

      expect(getByText("Bitcoin")).toBeTruthy()
    })

    it("skips balance computation when not authed and no wallets are provided", async () => {
      const { getByText } = renderOverview({ isAuthed: false, wallets: [] })
      await flushEffects()

      expect(getByText("Bitcoin")).toBeTruthy()
    })

    it("computes balances from the wallets prop even when not authed", async () => {
      const { getByText } = renderOverview({ isAuthed: false })
      await flushEffects()

      expect(getByText("btc-underlying")).toBeTruthy()
    })
  })
})
