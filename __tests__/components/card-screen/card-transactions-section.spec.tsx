import React from "react"
import { Text as RNText } from "react-native"
import { render } from "@testing-library/react-native"

import { CardTransactionsSection } from "@app/components/card-screen/card-transactions-section"

jest.mock("react-native-vector-icons/Ionicons", () => "Icon")

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        CardDashboard: {
          transactionsTitle: () => "Transactions",
          emptyTransactions: () => "No transactions yet",
        },
        TransactionStatus: {
          pending: () => "Pending",
          completed: () => "Completed",
        },
      },
    },
  }),
}))

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        primary: "#F7931A",
        grey2: "#999999",
        _green: "#00AA00",
        black: "#000000",
        grey1: "#666666",
        grey4: "#E0E0E0",
        grey5: "#F5F5F5",
      },
    },
  }),
  makeStyles: () => () => ({
    container: {},
    header: {},
    emptyText: {},
    groupContainer: {},
    dateLabel: {},
    transactionsList: {},
    iconContainer: {},
    detailsColumn: {},
    merchantName: {},
    timeAgo: {},
    amountColumn: {},
    amount: {},
    status: {},
  }),
}))

type TransactionStatus = "pending" | "completed"

type TransactionDetails = {
  transactionId: string
  cardUsed: string
  paymentMethod: string
  time: string
  merchant: string
  category: string
  location: string
  mccCode: string
  bitcoinRate: string
  bitcoinSpent: string
  conversionFee: string
}

type Transaction = {
  id: string
  merchantName: string
  timeAgo: string
  amount: string
  status: TransactionStatus
  details: TransactionDetails
}

type TransactionGroup = {
  date: string
  transactions: Transaction[]
}

const createMockDetails = (): TransactionDetails => ({
  transactionId: "TXN-TEST-001",
  cardUsed: "Visa •••• 4242",
  paymentMethod: "Contactless",
  time: "Jan 30, 10:00 AM",
  merchant: "Test Merchant",
  category: "Shopping",
  location: "Test Location",
  mccCode: "5411",
  bitcoinRate: "$100,000.00",
  bitcoinSpent: "10,000 SAT",
  conversionFee: "$0.00",
})

const renderWithProviders = (component: React.ReactElement) => {
  return render(component)
}

describe("CardTransactionsSection", () => {
  const mockTransactionGroups: TransactionGroup[] = [
    {
      date: "Today",
      transactions: [
        {
          id: "1",
          merchantName: "Starbucks",
          timeAgo: "2 minutes ago",
          amount: "-$5.75",
          status: "pending",
          details: createMockDetails(),
        },
        {
          id: "2",
          merchantName: "Amazon",
          timeAgo: "1 hour ago",
          amount: "-$24.99",
          status: "completed",
          details: createMockDetails(),
        },
      ],
    },
    {
      date: "Yesterday",
      transactions: [
        {
          id: "3",
          merchantName: "Netflix",
          timeAgo: "18 hours ago",
          amount: "-$15.99",
          status: "completed",
          details: createMockDetails(),
        },
      ],
    },
  ]

  describe("rendering with transactions", () => {
    it("renders without crashing", () => {
      const { toJSON } = renderWithProviders(
        <CardTransactionsSection groups={mockTransactionGroups} />,
      )

      expect(toJSON()).toBeTruthy()
    })

    it("displays the transactions title", () => {
      const { getByText } = renderWithProviders(
        <CardTransactionsSection groups={mockTransactionGroups} />,
      )

      expect(getByText("Transactions")).toBeTruthy()
    })

    it("displays date group labels", () => {
      const { getByText } = renderWithProviders(
        <CardTransactionsSection groups={mockTransactionGroups} />,
      )

      expect(getByText("Today")).toBeTruthy()
      expect(getByText("Yesterday")).toBeTruthy()
    })

    it("displays all transaction merchant names", () => {
      const { getByText } = renderWithProviders(
        <CardTransactionsSection groups={mockTransactionGroups} />,
      )

      expect(getByText("Starbucks")).toBeTruthy()
      expect(getByText("Amazon")).toBeTruthy()
      expect(getByText("Netflix")).toBeTruthy()
    })

    it("displays all transaction amounts", () => {
      const { getByText } = renderWithProviders(
        <CardTransactionsSection groups={mockTransactionGroups} />,
      )

      expect(getByText("-$5.75")).toBeTruthy()
      expect(getByText("-$24.99")).toBeTruthy()
      expect(getByText("-$15.99")).toBeTruthy()
    })

    it("displays all transaction time ago values", () => {
      const { getByText } = renderWithProviders(
        <CardTransactionsSection groups={mockTransactionGroups} />,
      )

      expect(getByText("2 minutes ago")).toBeTruthy()
      expect(getByText("1 hour ago")).toBeTruthy()
      expect(getByText("18 hours ago")).toBeTruthy()
    })

    it("displays transaction statuses", () => {
      const { getAllByText, getByText } = renderWithProviders(
        <CardTransactionsSection groups={mockTransactionGroups} />,
      )

      expect(getByText("Pending")).toBeTruthy()
      expect(getAllByText("Completed")).toHaveLength(2)
    })
  })

  describe("rendering with empty transactions", () => {
    it("renders without crashing when groups array is empty", () => {
      const { toJSON } = renderWithProviders(<CardTransactionsSection groups={[]} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays the transactions title when empty", () => {
      const { getByText } = renderWithProviders(<CardTransactionsSection groups={[]} />)

      expect(getByText("Transactions")).toBeTruthy()
    })

    it("displays empty state message when no transactions", () => {
      const { getByText } = renderWithProviders(<CardTransactionsSection groups={[]} />)

      expect(getByText("No transactions yet")).toBeTruthy()
    })

    it("does not display date labels when empty", () => {
      const { queryByText } = renderWithProviders(<CardTransactionsSection groups={[]} />)

      expect(queryByText("Today")).toBeNull()
      expect(queryByText("Yesterday")).toBeNull()
    })
  })

  describe("rendering with single group", () => {
    const singleGroupTransactions: TransactionGroup[] = [
      {
        date: "Today",
        transactions: [
          {
            id: "1",
            merchantName: "Coffee Shop",
            timeAgo: "just now",
            amount: "-$4.50",
            status: "pending",
            details: createMockDetails(),
          },
        ],
      },
    ]

    it("renders single group correctly", () => {
      const { getByText, queryByText } = renderWithProviders(
        <CardTransactionsSection groups={singleGroupTransactions} />,
      )

      expect(getByText("Today")).toBeTruthy()
      expect(getByText("Coffee Shop")).toBeTruthy()
      expect(queryByText("Yesterday")).toBeNull()
    })
  })

  describe("rendering with multiple transactions in one group", () => {
    const multipleTransactionsGroup: TransactionGroup[] = [
      {
        date: "Today",
        transactions: [
          {
            id: "1",
            merchantName: "Store A",
            timeAgo: "1 min ago",
            amount: "-$10.00",
            status: "pending",
            details: createMockDetails(),
          },
          {
            id: "2",
            merchantName: "Store B",
            timeAgo: "5 min ago",
            amount: "-$20.00",
            status: "pending",
            details: createMockDetails(),
          },
          {
            id: "3",
            merchantName: "Store C",
            timeAgo: "10 min ago",
            amount: "-$30.00",
            status: "completed",
            details: createMockDetails(),
          },
          {
            id: "4",
            merchantName: "Store D",
            timeAgo: "15 min ago",
            amount: "-$40.00",
            status: "completed",
            details: createMockDetails(),
          },
        ],
      },
    ]

    it("renders all transactions in a single group", () => {
      const { getByText } = renderWithProviders(
        <CardTransactionsSection groups={multipleTransactionsGroup} />,
      )

      expect(getByText("Store A")).toBeTruthy()
      expect(getByText("Store B")).toBeTruthy()
      expect(getByText("Store C")).toBeTruthy()
      expect(getByText("Store D")).toBeTruthy()
    })

    it("displays correct amounts for all transactions", () => {
      const { getByText } = renderWithProviders(
        <CardTransactionsSection groups={multipleTransactionsGroup} />,
      )

      expect(getByText("-$10.00")).toBeTruthy()
      expect(getByText("-$20.00")).toBeTruthy()
      expect(getByText("-$30.00")).toBeTruthy()
      expect(getByText("-$40.00")).toBeTruthy()
    })
  })

  describe("rendering with different date formats", () => {
    const differentDatesGroups: TransactionGroup[] = [
      {
        date: "January 15, 2024",
        transactions: [
          {
            id: "1",
            merchantName: "Shop",
            timeAgo: "2 weeks ago",
            amount: "-$100.00",
            status: "completed",
            details: createMockDetails(),
          },
        ],
      },
      {
        date: "December 25, 2023",
        transactions: [
          {
            id: "2",
            merchantName: "Gift Store",
            timeAgo: "1 month ago",
            amount: "-$50.00",
            status: "completed",
            details: createMockDetails(),
          },
        ],
      },
    ]

    it("displays custom date formats correctly", () => {
      const { getByText } = renderWithProviders(
        <CardTransactionsSection groups={differentDatesGroups} />,
      )

      expect(getByText("January 15, 2024")).toBeTruthy()
      expect(getByText("December 25, 2023")).toBeTruthy()
    })
  })
})
