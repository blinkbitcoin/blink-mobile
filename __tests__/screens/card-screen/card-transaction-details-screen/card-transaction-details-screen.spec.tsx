import React from "react"
import { render, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardTransactionDetailsScreen } from "@app/screens/card-screen/card-transaction-details-screen"
import { ContextForScreen } from "../../helper"
import { TransactionStatus } from "@app/graphql/generated"

jest.mock("react-native-vector-icons/Ionicons", () => "Icon")

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
jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ formatCurrency: mockFormatCurrency }),
}))

const mockUseCardTransaction = jest.fn()
jest.mock(
  "@app/screens/card-screen/card-transaction-details-screen/hooks/use-card-transaction",
  () => ({
    useCardTransaction: (id: string) => mockUseCardTransaction(id),
  }),
)

const TRANSACTION_1 = {
  id: "1",
  amount: 12.5,
  currency: "USD",
  merchantName: "SuperSelectos",
  status: TransactionStatus.Pending,
  createdAt: "2025-01-30T10:58:00.000Z",
}

const TRANSACTION_2 = {
  id: "2",
  amount: 5.75,
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
        params: { transactionId: "1" },
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
        params: { transactionId: "1" },
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

      expect(getByText("1")).toBeTruthy()
    })
  })

  describe("merchant information section", () => {
    beforeEach(() => {
      mockUseRoute.mockReturnValue({
        params: { transactionId: "1" },
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
        params: { transactionId: "1" },
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
        params: { transactionId: "1" },
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
        params: { transactionId: "2" },
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
        params: { transactionId: "1" },
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
})
