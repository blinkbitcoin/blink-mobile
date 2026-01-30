import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { StatementItem } from "@app/components/card-screen"
import theme from "@app/rne-theme/theme"

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
}

describe("StatementItem", () => {
  const mockOnDownload = jest.fn()

  const defaultProps = {
    title: "July 2025",
    subtitle1: "Jul 1 - Jul 30, 2025",
    subtitle2: "5 transactions, $121.00 spent",
    onDownload: mockOnDownload,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = renderWithTheme(<StatementItem {...defaultProps} />)
      expect(toJSON()).toBeTruthy()
    })

    it("displays title correctly", () => {
      const { getByText } = renderWithTheme(<StatementItem {...defaultProps} />)
      expect(getByText("July 2025")).toBeTruthy()
    })

    it("displays subtitle1 correctly", () => {
      const { getByText } = renderWithTheme(<StatementItem {...defaultProps} />)
      expect(getByText("Jul 1 - Jul 30, 2025")).toBeTruthy()
    })

    it("displays subtitle2 correctly", () => {
      const { getByText } = renderWithTheme(<StatementItem {...defaultProps} />)
      expect(getByText("5 transactions, $121.00 spent")).toBeTruthy()
    })

    it("renders without subtitle1", () => {
      const { getByText, queryByText } = renderWithTheme(
        <StatementItem
          title="August 2025"
          subtitle2="3 transactions"
          onDownload={mockOnDownload}
        />,
      )
      expect(getByText("August 2025")).toBeTruthy()
      expect(getByText("3 transactions")).toBeTruthy()
      expect(queryByText("Jul 1 - Jul 30, 2025")).toBeNull()
    })

    it("renders without subtitle2", () => {
      const { getByText, queryByText } = renderWithTheme(
        <StatementItem
          title="August 2025"
          subtitle1="Aug 1 - Aug 30, 2025"
          onDownload={mockOnDownload}
        />,
      )
      expect(getByText("August 2025")).toBeTruthy()
      expect(getByText("Aug 1 - Aug 30, 2025")).toBeTruthy()
      expect(queryByText("5 transactions")).toBeNull()
    })

    it("renders with only title", () => {
      const { getByText } = renderWithTheme(
        <StatementItem title="September 2025" onDownload={mockOnDownload} />,
      )
      expect(getByText("September 2025")).toBeTruthy()
    })
  })

  describe("download state", () => {
    it("renders with isDownloaded false by default", () => {
      const { toJSON } = renderWithTheme(<StatementItem {...defaultProps} />)
      expect(toJSON()).toBeTruthy()
    })

    it("renders with isDownloaded true", () => {
      const { toJSON } = renderWithTheme(
        <StatementItem {...defaultProps} isDownloaded={true} />,
      )
      expect(toJSON()).toBeTruthy()
    })

    it("renders with isDownloaded false", () => {
      const { toJSON } = renderWithTheme(
        <StatementItem {...defaultProps} isDownloaded={false} />,
      )
      expect(toJSON()).toBeTruthy()
    })
  })

  describe("interaction", () => {
    it("calls onDownload when download button is pressed", () => {
      const { getByTestId } = renderWithTheme(<StatementItem {...defaultProps} />)

      const downloadButton = getByTestId("statement-download-button")
      fireEvent.press(downloadButton)

      expect(mockOnDownload).toHaveBeenCalledTimes(1)
    })

    it("calls onDownload multiple times when pressed multiple times", () => {
      const { getByTestId } = renderWithTheme(<StatementItem {...defaultProps} />)

      const downloadButton = getByTestId("statement-download-button")
      fireEvent.press(downloadButton)
      fireEvent.press(downloadButton)
      fireEvent.press(downloadButton)

      expect(mockOnDownload).toHaveBeenCalledTimes(3)
    })
  })

  describe("different content", () => {
    it("renders with current statement content", () => {
      const { getByText } = renderWithTheme(
        <StatementItem
          title="August 2025"
          subtitle1="Spent $1,021.00"
          onDownload={mockOnDownload}
        />,
      )
      expect(getByText("August 2025")).toBeTruthy()
      expect(getByText("Spent $1,021.00")).toBeTruthy()
    })

    it("renders with past statement content", () => {
      const { getByText } = renderWithTheme(
        <StatementItem
          title="June 2025"
          subtitle1="Jun 1 - Jun 30, 2025"
          subtitle2="10 transactions, $500.00 spent"
          onDownload={mockOnDownload}
          isDownloaded={true}
        />,
      )
      expect(getByText("June 2025")).toBeTruthy()
      expect(getByText("Jun 1 - Jun 30, 2025")).toBeTruthy()
      expect(getByText("10 transactions, $500.00 spent")).toBeTruthy()
    })
  })
})
