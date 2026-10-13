import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import WalletOverview from "@app/components/wallet-overview/wallet-overview"
import { WalletCurrency } from "@app/graphql/generated"
import { HideAmountContextProvider } from "@app/graphql/hide-amount-context"
import { IsAuthedContextProvider } from "@app/graphql/is-authed-context"
import { AccountBalance, WalletBalance } from "@app/graphql/wallets-utils"
import { GateReason } from "@app/types/account"
import { CARD } from "@app/types/amounts"
import { ContextForScreen } from "../../screens/helper"
import { flushEffects } from "../../helpers/flush-effects"

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
let mockIsRegionDetermined = true
/** The gate's own reading of a closed gate, mirrored so the label can be asserted per reason. */
const mockGateReason = (): GateReason | null => {
  if (mockIsAnonMode) return GateReason.Anon
  if (!mockIsRestricted()) return null
  return mockIsRegionDetermined ? GateReason.Region : GateReason.UnknownRegion
}
jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceGated: () => mockIsAnonMode || mockIsRestricted(),
  useDollarBalanceGate: () => ({
    isGated: mockIsAnonMode || mockIsRestricted(),
    isRegionPending: mockIsRegionPending,
    reason: mockGateReason(),
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

/** The card balance is a BTC amount like the bitcoin wallet's, so the formatter tells
 *  them apart by amount for the card-row assertions. */
const mockCardBalanceSats = 150_000

const mockDisplayCurrency = jest.fn()
jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({
      moneyAmount,
    }: {
      moneyAmount: { currency: string; amount: number }
    }) => {
      if (moneyAmount.currency === "USD") return "usd-underlying"
      if (moneyAmount.amount === mockCardBalanceSats) return "card-underlying"
      return "btc-underlying"
    },
    displayCurrency: mockDisplayCurrency(),
    moneyAmountToDisplayCurrencyString: () => "display-amount",
  }),
}))

const walletsFixture: readonly WalletBalance[] = [
  { id: "btc-id", walletCurrency: WalletCurrency.Btc, balance: 174726 },
  { id: "usd-id", walletCurrency: WalletCurrency.Usd, balance: 6942 },
]

const cardAccount: AccountBalance = {
  id: "card-id",
  walletCurrency: CARD,
  balance: mockCardBalanceSats,
}

const withCardFixture: readonly AccountBalance[] = [...walletsFixture, cardAccount]

const mockSetStablesatModalVisible = jest.fn()

type RenderOptions = {
  loading?: boolean
  accounts?: readonly AccountBalance[]
  hideAmount?: boolean
  toggleHideAmount?: () => void
  isAuthed?: boolean
  onGatedTap?: () => void
}

const overviewTree = ({
  loading = false,
  accounts = walletsFixture,
  hideAmount = false,
  toggleHideAmount = jest.fn(),
  isAuthed = true,
  onGatedTap,
}: RenderOptions = {}) => (
  <ContextForScreen>
    <IsAuthedContextProvider value={isAuthed}>
      <HideAmountContextProvider value={{ hideAmount, toggleHideAmount }}>
        <WalletOverview
          loading={loading}
          accounts={accounts}
          setIsStablesatModalVisible={mockSetStablesatModalVisible}
          onGatedTap={onGatedTap}
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
    mockIsRegionDetermined = true
    mockIsRestrictedRegion = false
    mockIsRestricted.mockReturnValue(false)
    mockDisplayCurrency.mockReturnValue("USD")
  })

  describe("Card row", () => {
    it("shows the Card row with its balance when the accounts include a card", async () => {
      const { getByText } = renderOverview({ accounts: withCardFixture })
      await flushEffects()

      expect(getByText("Card")).toBeTruthy()
      expect(getByText("card-underlying")).toBeTruthy()
    })

    it("hides the Card row when the accounts have no card", async () => {
      const { queryByText } = renderOverview()
      await flushEffects()

      expect(queryByText("Card")).toBeNull()
      expect(queryByText("card-underlying")).toBeNull()
    })

    it("masks the card balance when hide amount is enabled", async () => {
      const { getByText, getAllByTestId, queryByText } = renderOverview({
        accounts: withCardFixture,
        hideAmount: true,
      })
      await flushEffects()

      expect(getByText("Card")).toBeTruthy()
      expect(queryByText("card-underlying")).toBeNull()
      expect(getAllByTestId("hidden-balance-placeholder").length).toBeGreaterThanOrEqual(
        3,
      )
    })

    it("navigates to the card dashboard when the Card row is pressed", async () => {
      const { getByText } = renderOverview({ accounts: withCardFixture })
      await flushEffects()

      fireEvent.press(getByText("Card"))

      expect(mockNavigate).toHaveBeenCalledWith("cardDashboardScreen")
    })

    it("keeps the card account out of the transaction history wallets", async () => {
      const { getByText } = renderOverview({ accounts: withCardFixture })
      await flushEffects()

      fireEvent.press(getByText("Bitcoin"))

      expect(mockNavigate).toHaveBeenCalledWith(
        "transactionHistory",
        expect.objectContaining({
          wallets: walletsFixture,
          currencyFilter: WalletCurrency.Btc,
        }),
      )
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
        accounts: emptyUsdWallets,
        onGatedTap: jest.fn(),
      })
      await flushEffects()

      expect(
        getByText("not available in your region", { includeHiddenElements: true }),
      ).toBeTruthy()
    })

    /** An unanswered query gates the row by policy but decided nothing about the region,
     *  so the label says the check failed and how to ask again, never "your region". */
    it("shows the retry label, not the region one, when asking has stopped working", async () => {
      mockIsRestricted.mockReturnValue(true)
      mockIsRegionDetermined = false
      const emptyUsdWallets: readonly WalletBalance[] = [
        { id: "btc-id", walletCurrency: WalletCurrency.Btc, balance: 174726 },
        { id: "usd-id", walletCurrency: WalletCurrency.Usd, balance: 0 },
      ]

      const { getByText, queryByText } = renderOverview({
        accounts: emptyUsdWallets,
        onGatedTap: jest.fn(),
      })
      await flushEffects()

      expect(
        getByText("couldn't check availability, pull down to retry", {
          includeHiddenElements: true,
        }),
      ).toBeTruthy()
      expect(queryByText("not available in your region")).toBeNull()
    })

    /** A sanctioned row opens the sanctions modal on tap, so no pull can reopen it: the
     *  region label stands even while the compliance query is unanswered. */
    it("keeps the region label in a restricted region even when asking has stopped working", async () => {
      mockIsRestrictedRegion = true
      mockIsRestricted.mockReturnValue(true)
      mockIsRegionDetermined = false
      const emptyUsdWallets: readonly WalletBalance[] = [
        { id: "btc-id", walletCurrency: WalletCurrency.Btc, balance: 174726 },
        { id: "usd-id", walletCurrency: WalletCurrency.Usd, balance: 0 },
      ]

      const { getByText, queryByText } = renderOverview({
        accounts: emptyUsdWallets,
        onGatedTap: jest.fn(),
      })
      await flushEffects()

      expect(
        getByText("not available in your region", { includeHiddenElements: true }),
      ).toBeTruthy()
      expect(queryByText("couldn't check availability, pull down to retry")).toBeNull()
    })

    it("shows the Incognito mode label when the mode is Anon and the balance is empty", async () => {
      mockIsAnonMode = true
      const emptyUsdWallets: readonly WalletBalance[] = [
        { id: "btc-id", walletCurrency: WalletCurrency.Btc, balance: 174726 },
        { id: "usd-id", walletCurrency: WalletCurrency.Usd, balance: 0 },
      ]

      const { getByText, queryByText } = renderOverview({
        accounts: emptyUsdWallets,
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
        accounts: emptyUsdWallets,
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

      const { getByText } = renderOverview({ accounts: emptyUsdWallets, onGatedTap })
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
      const { getByText } = renderOverview({ accounts: [] })

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

  describe("authentication and account sources", () => {
    it("renders with default balances when no accounts prop is passed", async () => {
      const { getByText } = renderOverview({ accounts: undefined })
      await flushEffects()

      expect(getByText("Bitcoin")).toBeTruthy()
    })

    it("skips balance computation when not authed and no accounts are provided", async () => {
      const { getByText } = renderOverview({ isAuthed: false, accounts: [] })
      await flushEffects()

      expect(getByText("Bitcoin")).toBeTruthy()
    })

    it("computes balances from the accounts prop even when not authed", async () => {
      const { getByText } = renderOverview({ isAuthed: false })
      await flushEffects()

      expect(getByText("btc-underlying")).toBeTruthy()
    })
  })
})
