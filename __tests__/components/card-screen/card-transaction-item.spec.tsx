import React from "react"
import { Text as RNText } from "react-native"
import { render } from "@testing-library/react-native"

import { CardTransactionItem } from "@app/components/card-screen/card-transaction-item"

jest.mock("react-native-vector-icons/Ionicons", () => "Icon")

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        TransactionStatus: {
          pending: () => "Pending",
          completed: () => "Completed",
          declined: () => "Declined",
          reversed: () => "Reversed",
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
        error: "#FF0000",
        _orange: "#FF8C00",
        black: "#000000",
      },
    },
  }),
  makeStyles: () => () => ({
    container: {},
    iconContainer: {},
    detailsColumn: {},
    merchantName: {},
    timeAgo: {},
    amountColumn: {},
    amount: {},
    status: {},
  }),
}))

const renderWithProviders = (component: React.ReactElement) => {
  return render(component)
}

describe("CardTransactionItem", () => {
  describe("rendering with pending status", () => {
    const pendingProps = {
      merchantName: "Starbucks",
      timeAgo: "2 minutes ago",
      amount: "-$5.75",
      status: "pending" as const,
    }

    it("renders without crashing", () => {
      const { toJSON } = renderWithProviders(<CardTransactionItem {...pendingProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays the merchant name", () => {
      const { getByText } = renderWithProviders(<CardTransactionItem {...pendingProps} />)

      expect(getByText("Starbucks")).toBeTruthy()
    })

    it("displays the time ago", () => {
      const { getByText } = renderWithProviders(<CardTransactionItem {...pendingProps} />)

      expect(getByText("2 minutes ago")).toBeTruthy()
    })

    it("displays the amount", () => {
      const { getByText } = renderWithProviders(<CardTransactionItem {...pendingProps} />)

      expect(getByText("-$5.75")).toBeTruthy()
    })

    it("displays pending status text", () => {
      const { getByText } = renderWithProviders(<CardTransactionItem {...pendingProps} />)

      expect(getByText("Pending")).toBeTruthy()
    })
  })

  describe("rendering with completed status", () => {
    const completedProps = {
      merchantName: "Amazon",
      timeAgo: "1 hour ago",
      amount: "-$24.99",
      status: "completed" as const,
    }

    it("renders without crashing", () => {
      const { toJSON } = renderWithProviders(<CardTransactionItem {...completedProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays the merchant name", () => {
      const { getByText } = renderWithProviders(
        <CardTransactionItem {...completedProps} />,
      )

      expect(getByText("Amazon")).toBeTruthy()
    })

    it("displays the time ago", () => {
      const { getByText } = renderWithProviders(
        <CardTransactionItem {...completedProps} />,
      )

      expect(getByText("1 hour ago")).toBeTruthy()
    })

    it("displays the amount", () => {
      const { getByText } = renderWithProviders(
        <CardTransactionItem {...completedProps} />,
      )

      expect(getByText("-$24.99")).toBeTruthy()
    })

    it("displays completed status text", () => {
      const { getByText } = renderWithProviders(
        <CardTransactionItem {...completedProps} />,
      )

      expect(getByText("Completed")).toBeTruthy()
    })
  })

  describe("rendering with various data", () => {
    it("renders with long merchant name", () => {
      const { getByText } = renderWithProviders(
        <CardTransactionItem
          merchantName="SuperSelectos Mall Plaza Downtown Store"
          timeAgo="5 hours ago"
          amount="-$150.00"
          status="completed"
        />,
      )

      expect(getByText("SuperSelectos Mall Plaza Downtown Store")).toBeTruthy()
    })

    it("renders with small amount", () => {
      const { getByText } = renderWithProviders(
        <CardTransactionItem
          merchantName="Coffee Shop"
          timeAgo="just now"
          amount="-$0.50"
          status="pending"
        />,
      )

      expect(getByText("-$0.50")).toBeTruthy()
    })

    it("renders with large amount", () => {
      const { getByText } = renderWithProviders(
        <CardTransactionItem
          merchantName="Electronics Store"
          timeAgo="2 days ago"
          amount="-$1,299.99"
          status="completed"
        />,
      )

      expect(getByText("-$1,299.99")).toBeTruthy()
    })

    it("renders with different time formats", () => {
      const { getByText } = renderWithProviders(
        <CardTransactionItem
          merchantName="Restaurant"
          timeAgo="Yesterday at 8:30 PM"
          amount="-$45.00"
          status="completed"
        />,
      )

      expect(getByText("Yesterday at 8:30 PM")).toBeTruthy()
    })
  })

  describe("status display", () => {
    it("shows Pending for pending transactions", () => {
      const { getByText, queryByText } = renderWithProviders(
        <CardTransactionItem
          merchantName="Store"
          timeAgo="1 min ago"
          amount="-$10.00"
          status="pending"
        />,
      )

      expect(getByText("Pending")).toBeTruthy()
      expect(queryByText("Completed")).toBeNull()
    })

    it("shows Completed for completed transactions", () => {
      const { getByText, queryByText } = renderWithProviders(
        <CardTransactionItem
          merchantName="Store"
          timeAgo="1 min ago"
          amount="-$10.00"
          status="completed"
        />,
      )

      expect(getByText("Completed")).toBeTruthy()
      expect(queryByText("Pending")).toBeNull()
    })
  })

  describe("content integrity", () => {
    it("displays all transaction details together", () => {
      const { getByText } = renderWithProviders(
        <CardTransactionItem
          merchantName="Uber Eats"
          timeAgo="3 hours ago"
          amount="-$18.50"
          status="completed"
        />,
      )

      expect(getByText("Uber Eats")).toBeTruthy()
      expect(getByText("3 hours ago")).toBeTruthy()
      expect(getByText("-$18.50")).toBeTruthy()
      expect(getByText("Completed")).toBeTruthy()
    })
  })
})
