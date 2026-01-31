import React from "react"
import { Text as RNText } from "react-native"
import { render } from "@testing-library/react-native"

import { StatusBadge } from "@app/components/card-screen/status-badge"

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
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
        black: "#000000",
        warning: "#FFA726",
        success: "#66BB6A",
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
      const { toJSON } = render(<StatusBadge status="pending" />)

      expect(toJSON()).toBeTruthy()
    })
  })

  describe("pending status", () => {
    it("displays pending text", () => {
      const { getByText } = render(<StatusBadge status="pending" />)

      expect(getByText("Pending")).toBeTruthy()
    })

    it("renders pending badge", () => {
      const { toJSON } = render(<StatusBadge status="pending" />)

      expect(toJSON()).toBeTruthy()
    })
  })

  describe("completed status", () => {
    it("displays completed text", () => {
      const { getByText } = render(<StatusBadge status="completed" />)

      expect(getByText("Completed")).toBeTruthy()
    })

    it("renders completed badge", () => {
      const { toJSON } = render(<StatusBadge status="completed" />)

      expect(toJSON()).toBeTruthy()
    })
  })

  describe("status changes", () => {
    it("updates text when status changes from pending to completed", () => {
      const { getByText, rerender } = render(<StatusBadge status="pending" />)

      expect(getByText("Pending")).toBeTruthy()

      rerender(<StatusBadge status="completed" />)

      expect(getByText("Completed")).toBeTruthy()
    })

    it("updates text when status changes from completed to pending", () => {
      const { getByText, rerender } = render(<StatusBadge status="completed" />)

      expect(getByText("Completed")).toBeTruthy()

      rerender(<StatusBadge status="pending" />)

      expect(getByText("Pending")).toBeTruthy()
    })
  })

  describe("multiple badges", () => {
    it("renders multiple badges with different statuses", () => {
      const { getAllByText } = render(
        <>
          <StatusBadge status="pending" />
          <StatusBadge status="completed" />
        </>,
      )

      expect(getAllByText("Pending")).toHaveLength(1)
      expect(getAllByText("Completed")).toHaveLength(1)
    })

    it("renders multiple badges with same status", () => {
      const { getAllByText } = render(
        <>
          <StatusBadge status="pending" />
          <StatusBadge status="pending" />
        </>,
      )

      expect(getAllByText("Pending")).toHaveLength(2)
    })
  })

  describe("text content", () => {
    it("displays localized pending text", () => {
      const { getByText } = render(<StatusBadge status="pending" />)

      const pendingText = getByText("Pending")
      expect(pendingText).toBeTruthy()
    })

    it("displays localized completed text", () => {
      const { getByText } = render(<StatusBadge status="completed" />)

      const completedText = getByText("Completed")
      expect(completedText).toBeTruthy()
    })
  })
})
