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
let mockIsRegionPending = false
jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceRestricted: () => mockIsRestricted(),
  useDollarBalanceGated: () => mockIsAnonMode || mockIsRestricted(),
  useDollarBalanceGate: () => ({
    isGated: mockIsAnonMode || mockIsRestricted(),
    isRegionPending: mockIsRegionPending,
  }),
}))

let mockIsRestrictedRegion = false
jest.mock("@app/components/restricted-region", () => ({
  useRestrictedRegion: () => ({
    isRestrictedRegion: mockIsRestrictedRegion,
    isRestrictedRegionModalVisible: false,
    presentRestrictedRegionModal: jest.fn(),
  }),
}))

let mockIsAnonMode = false
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ isAnonMode: mockIsAnonMode }),
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
  toggleHideAmount?: () => void
  isAuthed?: boolean
  onGatedTap?: () => void
  hasCard?: boolean
  cardLastFour?: string | null
}

const overviewTree = ({
  loading = false,
  wallets = walletsFixture,
  hideAmount = false,
  toggleHideAmount = jest.fn(),
  isAuthed = true,
  onGatedTap,
  hasCard = false,
  cardLastFour,
}: RenderOptions = {}) => (
  <ContextForScreen>
    <IsAuthedContextProvider value={isAuthed}>
      <HideAmountContextProvider value={{ hideAmount, toggleHideAmount }}>
        <WalletOverview
          loading={loading}
          wallets={wallets}
          setIsStablesatModalVisible={mockSetStablesatModalVisible}
          onGatedTap={onGatedTap}
          hasCard={hasCard}
          cardLastFour={cardLastFour}
        />
      </HideAmountContextProvider>
    </IsAuthedContextProvider>
  </ContextForScreen>
)

const renderOverview = (options: RenderOptions = {}) => render(overviewTree(options))

describe("WalletOverview", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockIsAnonMode = false
    mockIsRegionPending = false
    mockIsRestrictedRegion = false
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
      const { getAllByTestId, queryByText } = renderOverview({ hideAmount: true })
      await flushEffects()

      expect(getAllByTestId("hidden-balance-placeholder").length).toBeGreaterThanOrEqual(
        2,
      )
      expect(queryByText("btc-underlying")).toBeNull()
      expect(queryByText("usd-underlying")).toBeNull()
    })

    it("shows the underlying dollar amount when the display currency is not USD", async () => {
      mockDisplayCurrency.mockReturnValue("EUR")

      const { getByText } = renderOverview()
      await flushEffects()

      expect(getByText("usd-underlying", { includeHiddenElements: true })).toBeTruthy()
    })

    it("shows the formatted balances by default", async () => {
      const { getByText, getAllByText } = renderOverview()
      await flushEffects()

      expect(getByText("btc-underlying")).toBeTruthy()
      expect(getAllByText("display-amount").length).toBeGreaterThanOrEqual(1)
    })

    it("keeps showing the amount when the restricted balance is not empty", async () => {
      mockIsRestricted.mockReturnValue(true)
      const onGatedTap = jest.fn()

      const { getByTestId, queryByText } = renderOverview({ onGatedTap })
      await flushEffects()

      expect(queryByText("not available in your region")).toBeNull()
      expect(
        getByTestId("stablesats-balance", { includeHiddenElements: true }),
      ).toBeTruthy()

      fireEvent.press(getByTestId("stablesats-balance", { includeHiddenElements: true }))
      expect(onGatedTap).toHaveBeenCalledTimes(1)
    })

    it("shows the restriction label when the restricted balance is empty", async () => {
      mockIsRestricted.mockReturnValue(true)
      const emptyUsdWallets: readonly WalletBalance[] = [
        { id: "btc-id", walletCurrency: WalletCurrency.Btc, balance: 174726 },
        { id: "usd-id", walletCurrency: WalletCurrency.Usd, balance: 0 },
      ]

      const { getByText } = renderOverview({
        wallets: emptyUsdWallets,
        onGatedTap: jest.fn(),
      })
      await flushEffects()

      expect(
        getByText("not available in your region", { includeHiddenElements: true }),
      ).toBeTruthy()
    })

    it("shows the Incognito mode label when the mode is Anon and the balance is empty", async () => {
      mockIsAnonMode = true
      const emptyUsdWallets: readonly WalletBalance[] = [
        { id: "btc-id", walletCurrency: WalletCurrency.Btc, balance: 174726 },
        { id: "usd-id", walletCurrency: WalletCurrency.Usd, balance: 0 },
      ]

      const { getByText, queryByText } = renderOverview({
        wallets: emptyUsdWallets,
        onGatedTap: jest.fn(),
      })
      await flushEffects()

      expect(
        getByText("not available in Incognito mode", { includeHiddenElements: true }),
      ).toBeTruthy()
      expect(queryByText("not available in your region")).toBeNull()
    })

    it("keeps showing the amount in Incognito mode when the balance is not empty", async () => {
      mockIsAnonMode = true
      const onGatedTap = jest.fn()

      const { getByTestId, queryByText } = renderOverview({ onGatedTap })
      await flushEffects()

      expect(queryByText("not available in Incognito mode")).toBeNull()
      expect(
        getByTestId("stablesats-balance", { includeHiddenElements: true }),
      ).toBeTruthy()

      fireEvent.press(getByTestId("stablesats-balance", { includeHiddenElements: true }))
      expect(onGatedTap).toHaveBeenCalledTimes(1)
    })

    it("shows neither the dollar amount nor the unavailable label while the region is still resolving", async () => {
      mockDisplayCurrency.mockReturnValue("EUR")
      mockIsRestricted.mockReturnValue(true)
      mockIsRegionPending = true
      const emptyUsdWallets: readonly WalletBalance[] = [
        { id: "btc-id", walletCurrency: WalletCurrency.Btc, balance: 174726 },
        { id: "usd-id", walletCurrency: WalletCurrency.Usd, balance: 0 },
      ]

      const { getByText, queryByText } = renderOverview({
        wallets: emptyUsdWallets,
        onGatedTap: jest.fn(),
      })
      await flushEffects()

      expect(queryByText("usd-underlying")).toBeNull()
      expect(queryByText("not available in your region")).toBeNull()
      expect(getByText("btc-underlying")).toBeTruthy()
    })

    it("shows the dollar amount once the pending region resolves to no restriction", async () => {
      mockDisplayCurrency.mockReturnValue("EUR")
      mockIsRegionPending = true

      const { getByText, queryByText, rerender } = renderOverview({
        onGatedTap: jest.fn(),
      })
      await flushEffects()

      expect(queryByText("usd-underlying")).toBeNull()

      mockIsRegionPending = false
      rerender(overviewTree({ onGatedTap: jest.fn() }))
      await flushEffects()

      expect(getByText("usd-underlying", { includeHiddenElements: true })).toBeTruthy()
    })

    it("disables the dollar row but keeps the amount in a restricted region", async () => {
      mockIsRestrictedRegion = true
      const onGatedTap = jest.fn()

      const { getByTestId, queryByText } = renderOverview({ onGatedTap })
      await flushEffects()

      expect(queryByText("not available in your region")).toBeNull()
      expect(
        getByTestId("stablesats-balance", { includeHiddenElements: true }),
      ).toBeTruthy()

      fireEvent.press(getByTestId("stablesats-balance", { includeHiddenElements: true }))
      expect(onGatedTap).toHaveBeenCalledTimes(1)
    })

    it("routes the gated dollar tap to onGatedTap in Incognito mode", async () => {
      mockIsAnonMode = true
      const onGatedTap = jest.fn()
      const emptyUsdWallets: readonly WalletBalance[] = [
        { id: "btc-id", walletCurrency: WalletCurrency.Btc, balance: 174726 },
        { id: "usd-id", walletCurrency: WalletCurrency.Usd, balance: 0 },
      ]

      const { getByText } = renderOverview({ wallets: emptyUsdWallets, onGatedTap })
      await flushEffects()

      fireEvent.press(
        getByText("not available in Incognito mode", { includeHiddenElements: true }),
      )

      expect(onGatedTap).toHaveBeenCalledTimes(1)
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe("interactions", () => {
    it("does not open the restriction explanation while the region is still resolving", async () => {
      mockIsRegionPending = true
      const onGatedTap = jest.fn()

      const { getByText } = renderOverview({ onGatedTap })
      await flushEffects()

      fireEvent.press(getByText("Dollar", { includeHiddenElements: true }))

      expect(onGatedTap).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

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
      const toggleHideAmount = jest.fn()

      const { getByTestId } = renderOverview({ toggleHideAmount })
      await flushEffects()

      fireEvent.press(getByTestId("icon-eye"))

      expect(toggleHideAmount).toHaveBeenCalledTimes(1)
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
