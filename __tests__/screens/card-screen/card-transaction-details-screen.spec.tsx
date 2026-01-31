import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardTransactionDetailsScreen } from "@app/screens/card-screen/card-transaction-details-screen"
import { ContextForScreen } from "../helper"

jest.mock("react-native-vector-icons/Ionicons", () => "Icon")

const mockUseRoute = jest.fn()
jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useRoute: () => mockUseRoute(),
  }
})

jest.mock("@app/screens/card-screen/card-mock-data", () => ({
  MOCK_TRANSACTIONS: [
    {
      date: "Today",
      transactions: [
        {
          id: "1",
          merchantName: "SuperSelectos",
          timeAgo: "2 minutes ago",
          amount: "-$12.50",
          status: "pending",
          details: {
            transactionId: "TXN-2025-000001",
            cardUsed: "Visa •••• 2121",
            paymentMethod: "Chip",
            time: "Jan 30, 10:58 AM",
            merchant: "SuperSelectos",
            category: "Groceries",
            location: "Blvd. Los Héroes, San Salvador, El Salvador",
            mccCode: "5411",
            bitcoinRate: "$102,450.00",
            bitcoinSpent: "12,203 SAT",
            conversionFee: "$0.00",
          },
        },
        {
          id: "2",
          merchantName: "Starbucks",
          timeAgo: "1 hour ago",
          amount: "-$5.75",
          status: "completed",
          details: {
            transactionId: "TXN-2025-000002",
            cardUsed: "Visa •••• 2121",
            paymentMethod: "Contactless",
            time: "Jan 30, 9:00 AM",
            merchant: "Starbucks",
            category: "Food & Dining",
            location: "Prospera Place, Kelowna, BC, Canada",
            mccCode: "5814",
            bitcoinRate: "$102,380.00",
            bitcoinSpent: "5,617 SAT",
            conversionFee: "$0.00",
          },
        },
      ],
    },
  ],
}))

describe("CardTransactionDetailsScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  describe("rendering with valid transaction", () => {
    beforeEach(() => {
      mockUseRoute.mockReturnValue({
        params: { transactionId: "1" },
      })
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

      const amounts = getAllByText("-$12.50")
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
        params: { transactionId: "1" },
      })
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

    it("displays transaction time", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Jan 30, 10:58 AM")).toBeTruthy()
    })

    it("displays transaction ID", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("TXN-2025-000001")).toBeTruthy()
    })

    it("displays card used", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Visa •••• 2121")).toBeTruthy()
    })

    it("displays payment method", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Chip")).toBeTruthy()
    })
  })

  describe("merchant information section", () => {
    beforeEach(() => {
      mockUseRoute.mockReturnValue({
        params: { transactionId: "1" },
      })
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

    it("displays category", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Groceries")).toBeTruthy()
    })

    it("displays location", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Blvd. Los Héroes, San Salvador, El Salvador")).toBeTruthy()
    })

    it("displays MCC code", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("5411")).toBeTruthy()
    })
  })

  describe("currency conversion section", () => {
    beforeEach(() => {
      mockUseRoute.mockReturnValue({
        params: { transactionId: "1" },
      })
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

    it("displays bitcoin rate", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("$102,450.00")).toBeTruthy()
    })

    it("displays bitcoin spent", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("12,203 SAT")).toBeTruthy()
    })

    it("displays conversion fee", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("$0.00")).toBeTruthy()
    })
  })

  describe("action buttons", () => {
    beforeEach(() => {
      mockUseRoute.mockReturnValue({
        params: { transactionId: "1" },
      })
    })

    it("displays view on map button", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("View on map")).toBeTruthy()
    })

    it("displays download receipt button", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Download receipt")).toBeTruthy()
    })

    it("displays report issue button", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Report issue")).toBeTruthy()
    })

    it("handles view on map button press", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const button = getByText("View on map")
      await act(async () => {
        fireEvent.press(button)
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        "View on map:",
        "Blvd. Los Héroes, San Salvador, El Salvador",
      )

      consoleSpy.mockRestore()
    })

    it("handles download receipt button press", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const button = getByText("Download receipt")
      await act(async () => {
        fireEvent.press(button)
      })

      expect(consoleSpy).toHaveBeenCalledWith("Download receipt:", "1")

      consoleSpy.mockRestore()
    })

    it("handles report issue button press", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const button = getByText("Report issue")
      await act(async () => {
        fireEvent.press(button)
      })

      expect(consoleSpy).toHaveBeenCalledWith("Report issue:", "1")

      consoleSpy.mockRestore()
    })
  })

  describe("warning card", () => {
    beforeEach(() => {
      mockUseRoute.mockReturnValue({
        params: { transactionId: "1" },
      })
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
    })

    it("displays not found message for invalid transaction ID", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Transaction not found")).toBeTruthy()
    })

    it("does not display transaction details for invalid ID", async () => {
      const { queryByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(queryByText("-$12.50")).toBeNull()
      expect(queryByText("Card information")).toBeNull()
    })
  })

  describe("completed transaction", () => {
    beforeEach(() => {
      mockUseRoute.mockReturnValue({
        params: { transactionId: "2" },
      })
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

      const amounts = getAllByText("-$5.75")
      expect(amounts.length).toBeGreaterThanOrEqual(1)
    })

    it("displays different payment method for transaction 2", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardTransactionDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Contactless")).toBeTruthy()
    })
  })

  describe("field labels", () => {
    beforeEach(() => {
      mockUseRoute.mockReturnValue({
        params: { transactionId: "1" },
      })
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
})
