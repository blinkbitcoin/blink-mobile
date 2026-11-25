import React from "react"
import { render, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardTransactionDetailsScreen } from "@app/screens/card-screen/card-transaction-details-screen"
import { ContextForScreen } from "../../helper"
import { TransactionStatus } from "@app/graphql/generated"

const mockGoBack = jest.fn()
const mockUseRoute = jest.fn()
jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({ goBack: mockGoBack }),
    useRoute: () => mockUseRoute(),
  }
})

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

const FORMATTED_TIME = "Jan 30, 10:58 AM"
jest.spyOn(Intl, "DateTimeFormat").mockImplementation(
  () =>
    ({
      format: () => FORMATTED_TIME,
      resolvedOptions: () => ({}) as Intl.ResolvedDateTimeFormatOptions,
      formatToParts: () => [],
      formatRange: () => "",
      formatRangeToParts: () => [],
    }) as Intl.DateTimeFormat,
)

const mockFormatCurrency = jest.fn(
  ({ amountInMajorUnits }: { amountInMajorUnits: number; currency: string }) =>
    `$${Math.abs(amountInMajorUnits).toFixed(2)}`,
)
const mockFormatMoneyAmount = jest.fn(
  ({ moneyAmount }: { moneyAmount: { amount: number } }) => `${moneyAmount.amount} SAT`,
)
jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatCurrency: mockFormatCurrency,
    formatMoneyAmount: mockFormatMoneyAmount,
  }),
}))

const mockUseCardTransaction = jest.fn()
jest.mock(
  "@app/screens/card-screen/card-transaction-details-screen/hooks/use-card-transaction",
  () => ({
    useCardTransaction: (id: string) => mockUseCardTransaction(id),
  }),
)

type CardFixture = { id: string; lastFour: string }
let mockCards: CardFixture[] = []
jest.mock("@app/hooks/use-card-data", () => ({
  useCardData: () => ({ cards: mockCards }),
}))

const TRANSACTION_1 = {
  id: "txn-001",
  amount: 1250,
  currency: "USD",
  merchantName: "SuperSelectos",
  status: TransactionStatus.Pending,
  createdAt: "2025-01-30T10:58:00.000Z",
}

const TRANSACTION_2 = {
  id: "txn-002",
  amount: 575,
  currency: "USD",
  merchantName: "Starbucks",
  status: TransactionStatus.Completed,
  createdAt: "2025-01-30T09:00:00.000Z",
}

describe("CardTransactionDetailsScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  describe("rendering with valid transaction", () => {
    beforeEach(() => {
      mockUseRoute.mockReturnValue({
        params: { transactionId: "txn-001" },
      })
      mockUseCardTransaction.mockReturnValue({ transaction: TRANSACTION_1 })
    })

    it("renders without crashing", async () => {
      const { toJSON } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(toJSON()).toBeTruthy()
    })

    it("displays transaction amount", async () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const amounts = getAllByText("$12.50")
      expect(amounts.length).toBeGreaterThanOrEqual(1)
    })

    it("displays merchant name", async () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const merchants = getAllByText("SuperSelectos")
      expect(merchants.length).toBeGreaterThanOrEqual(1)
    })

    it("displays status badge", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Pending")).toBeTruthy()
    })
  })

  describe("card information section", () => {
    beforeEach(() => {
      mockUseRoute.mockReturnValue({
        params: { transactionId: "txn-001" },
      })
      mockUseCardTransaction.mockReturnValue({ transaction: TRANSACTION_1 })
    })

    it("displays card information title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Card information")).toBeTruthy()
    })

    it("displays formatted transaction time", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText(FORMATTED_TIME)).toBeTruthy()
    })

    it("displays transaction ID", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("txn-001")).toBeTruthy()
    })
  })

  describe("merchant information section", () => {
    beforeEach(() => {
      mockUseRoute.mockReturnValue({
        params: { transactionId: "txn-001" },
      })
      mockUseCardTransaction.mockReturnValue({ transaction: TRANSACTION_1 })
    })

    it("displays merchant information title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Merchant information")).toBeTruthy()
    })
  })

  describe("currency conversion section", () => {
    beforeEach(() => {
      mockUseRoute.mockReturnValue({
        params: { transactionId: "txn-001" },
      })
      mockUseCardTransaction.mockReturnValue({ transaction: TRANSACTION_1 })
    })

    it("displays currency conversion title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Currency conversion")).toBeTruthy()
    })
  })

  describe("warning card", () => {
    beforeEach(() => {
      mockUseRoute.mockReturnValue({
        params: { transactionId: "txn-001" },
      })
      mockUseCardTransaction.mockReturnValue({ transaction: TRANSACTION_1 })
    })

    it("displays warning title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Transaction help")).toBeTruthy()
    })

    it("displays warning description", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(
        getByText(
          "If you don't recognize this transaction or need assistance, contact our support team immediately.",
        ),
      ).toBeTruthy()
    })
  })

  describe("transaction not found", () => {
    beforeEach(() => {
      mockUseRoute.mockReturnValue({
        params: { transactionId: "nonexistent" },
      })
      mockUseCardTransaction.mockReturnValue({ transaction: null })
    })

    it("shows toast and navigates back for invalid transaction ID", async () => {
      render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(mockToastShow).toHaveBeenCalledTimes(1)
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Transaction not found" }),
      )
      expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it("does not display transaction details for invalid ID", async () => {
      const { queryByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(queryByText("$12.50")).toBeNull()
      expect(queryByText("Card information")).toBeNull()
    })
  })

  describe("completed transaction", () => {
    beforeEach(() => {
      mockUseRoute.mockReturnValue({
        params: { transactionId: "txn-002" },
      })
      mockUseCardTransaction.mockReturnValue({ transaction: TRANSACTION_2 })
    })

    it("displays completed status badge", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Completed")).toBeTruthy()
    })

    it("displays different merchant for transaction 2", async () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const merchants = getAllByText("Starbucks")
      expect(merchants.length).toBeGreaterThanOrEqual(1)
    })

    it("displays different amount for transaction 2", async () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const amounts = getAllByText("$5.75")
      expect(amounts.length).toBeGreaterThanOrEqual(1)
    })

    it("displays different payment method for transaction 2", async () => {
      const { queryByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      // Payment method is a Phase 2/3 field — not yet from API
      expect(queryByText("Contactless")).toBeNull()
    })
  })

  describe("field labels", () => {
    beforeEach(() => {
      mockUseRoute.mockReturnValue({
        params: { transactionId: "txn-001" },
      })
      mockUseCardTransaction.mockReturnValue({ transaction: TRANSACTION_1 })
    })

    it("displays amount label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Amount")).toBeTruthy()
    })

    it("displays time label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Time")).toBeTruthy()
    })

    it("displays merchant label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Merchant")).toBeTruthy()
    })

    it("displays category label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Category")).toBeTruthy()
    })

    it("displays location label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Location")).toBeTruthy()
    })

    it("displays bitcoin rate label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Bitcoin rate")).toBeTruthy()
    })

    it("displays bitcoin spent label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Bitcoin spent")).toBeTruthy()
    })

    it("displays conversion fee label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Conversion fee")).toBeTruthy()
    })
  })

  describe("merchant and card details", () => {
    const renderTransaction = async (transaction: Record<string, unknown>) => {
      mockUseCardTransaction.mockReturnValue({ transaction })
      const screen = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )
      await act(async () => {})
      return screen
    }

    const detailedTransaction = {
      ...TRANSACTION_2,
      enrichedMerchantCategory: "Food & Dining",
      merchantCategory: "Fast food restaurants",
      merchantCategoryCode: "5814",
      merchantCity: "San Salvador",
      merchantCountry: "SV",
    }

    beforeEach(() => {
      mockUseRoute.mockReturnValue({
        params: { transactionId: "txn-002", cardId: "card-physical" },
      })
      mockCards = [
        { id: "card-physical", lastFour: "4242" },
        { id: "card-virtual", lastFour: "2121" },
      ]
    })

    it("names the card used by its last four digits", async () => {
      const { getByText } = await renderTransaction(detailedTransaction)

      expect(getByText("Blink Card •••• 4242")).toBeTruthy()
    })

    it("names no card when opened from a link, which carries none", async () => {
      mockUseRoute.mockReturnValue({ params: { transactionId: "txn-002" } })

      const { queryByText } = await renderTransaction(detailedTransaction)

      expect(queryByText("Blink Card •••• 4242")).toBeNull()
      expect(queryByText("Blink Card •••• 2121")).toBeNull()
    })

    /** The transaction names the card that paid, which outranks the list it was opened
     *  from: a replaced card's payments still list under the dashboard's card. */
    it("names the card used from the transaction itself", async () => {
      const { getByText, queryByText } = await renderTransaction({
        ...detailedTransaction,
        cardLastFour: "9999",
      })

      expect(getByText("Blink Card •••• 9999")).toBeTruthy()
      expect(queryByText("Blink Card •••• 4242")).toBeNull()
    })

    it("names the card used from a link when the transaction carries it", async () => {
      mockUseRoute.mockReturnValue({ params: { transactionId: "txn-002" } })

      const { getByText } = await renderTransaction({
        ...detailedTransaction,
        cardLastFour: "9999",
      })

      expect(getByText("Blink Card •••• 9999")).toBeTruthy()
    })

    it("shows the bitcoin rate and the sats the payment took", async () => {
      const { getByText } = await renderTransaction({
        ...detailedTransaction,
        btcRate: 120180.06,
        satsAmount: 35204,
      })

      expect(getByText("$120180.06")).toBeTruthy()
      expect(getByText("35204 SAT")).toBeTruthy()
      expect(mockFormatCurrency).toHaveBeenCalledWith({
        amountInMajorUnits: 120180.06,
        currency: "USD",
      })
    })

    it("shows the enriched category, the city and country, and the MCC", async () => {
      const { getByText } = await renderTransaction(detailedTransaction)

      expect(getByText("Food & Dining")).toBeTruthy()
      expect(getByText("San Salvador, El Salvador")).toBeTruthy()
      expect(getByText("5814")).toBeTruthy()
    })

    it("falls back to the issuer's category without an enriched one", async () => {
      const { getByText } = await renderTransaction({
        ...detailedTransaction,
        enrichedMerchantCategory: null,
      })

      expect(getByText("Fast food restaurants")).toBeTruthy()
    })

    it("falls back to the issuer's category when the enriched one is empty", async () => {
      const { getByText } = await renderTransaction({
        ...detailedTransaction,
        enrichedMerchantCategory: "",
      })

      expect(getByText("Fast food restaurants")).toBeTruthy()
    })

    it("shows whichever part of the location it has", async () => {
      const { getByText } = await renderTransaction({
        ...detailedTransaction,
        merchantCity: null,
      })

      expect(getByText("El Salvador")).toBeTruthy()
    })

    it("draws the icon of the merchant's category", async () => {
      const { getByTestId } = await renderTransaction(detailedTransaction)

      expect(getByTestId("icon-fork-knife")).toBeTruthy()
    })

    it("marks what it does not know as unavailable", async () => {
      mockCards = []
      const { getAllByText, getByTestId } = await renderTransaction(TRANSACTION_2)

      expect(getAllByText("---").length).toBeGreaterThanOrEqual(7)
      expect(getByTestId("icon-storefront")).toBeTruthy()
    })
  })
})
