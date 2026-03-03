import React from "react"
import { Text as RNText } from "react-native"
import { render } from "@testing-library/react-native"

import { StatusBadge } from "@app/components/card-screen/status-badge"
import { TransactionStatus } from "@app/graphql/generated"

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
        black: "#000000",
        grey3: "#CCCCCC",
        success: "#66BB6A",
        error: "#EF5350",
        warning: "#FFA726",
      },
    },
  }),
  makeStyles: () => (_props: { backgroundColor: string }) => ({
    badge: {},
    text: {},
  }),
}))

describe("StatusBadge", () => {
  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<StatusBadge status={TransactionStatus.Pending} />)

      expect(toJSON()).toBeTruthy()
    })
  })

  describe("pending status", () => {
    it("displays pending text", () => {
      const { getByText } = render(<StatusBadge status={TransactionStatus.Pending} />)

      expect(getByText("Pending")).toBeTruthy()
    })

    it("renders pending badge", () => {
      const { toJSON } = render(<StatusBadge status={TransactionStatus.Pending} />)

      expect(toJSON()).toBeTruthy()
    })
  })

  describe("completed status", () => {
    it("displays completed text", () => {
      const { getByText } = render(<StatusBadge status={TransactionStatus.Completed} />)

      expect(getByText("Completed")).toBeTruthy()
    })

    it("renders completed badge", () => {
      const { toJSON } = render(<StatusBadge status={TransactionStatus.Completed} />)

      expect(toJSON()).toBeTruthy()
    })
  })

  describe("declined status", () => {
    it("displays declined text", () => {
      const { getByText } = render(<StatusBadge status={TransactionStatus.Declined} />)

      expect(getByText("Declined")).toBeTruthy()
    })
  })

  describe("reversed status", () => {
    it("displays reversed text", () => {
      const { getByText } = render(<StatusBadge status={TransactionStatus.Reversed} />)

      expect(getByText("Reversed")).toBeTruthy()
    })
  })

  describe("status changes", () => {
    it("updates text when status changes from pending to completed", () => {
      const { getByText, rerender } = render(
        <StatusBadge status={TransactionStatus.Pending} />,
      )

      expect(getByText("Pending")).toBeTruthy()

      rerender(<StatusBadge status={TransactionStatus.Completed} />)

      expect(getByText("Completed")).toBeTruthy()
    })

    it("updates text when status changes from completed to pending", () => {
      const { getByText, rerender } = render(
        <StatusBadge status={TransactionStatus.Completed} />,
      )

      expect(getByText("Completed")).toBeTruthy()

      rerender(<StatusBadge status={TransactionStatus.Pending} />)

      expect(getByText("Pending")).toBeTruthy()
    })
  })

  describe("multiple badges", () => {
    it("renders multiple badges with different statuses", () => {
      const { getAllByText } = render(
        <>
          <StatusBadge status={TransactionStatus.Pending} />
          <StatusBadge status={TransactionStatus.Completed} />
        </>,
      )

      expect(getAllByText("Pending")).toHaveLength(1)
      expect(getAllByText("Completed")).toHaveLength(1)
    })

    it("renders multiple badges with same status", () => {
      const { getAllByText } = render(
        <>
          <StatusBadge status={TransactionStatus.Pending} />
          <StatusBadge status={TransactionStatus.Pending} />
        </>,
      )

      expect(getAllByText("Pending")).toHaveLength(2)
    })
  })

  describe("text content", () => {
    it("displays localized pending text", () => {
      const { getByText } = render(<StatusBadge status={TransactionStatus.Pending} />)

      expect(getByText("Pending")).toBeTruthy()
    })

    it("displays localized completed text", () => {
      const { getByText } = render(<StatusBadge status={TransactionStatus.Completed} />)

      expect(getByText("Completed")).toBeTruthy()
    })
  })
})
