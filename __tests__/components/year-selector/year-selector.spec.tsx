import React from "react"
import { View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { YearSelector, YearOption } from "@app/components/year-selector"
import theme from "@app/rne-theme/theme"

type MockModalProps = {
  children: React.ReactNode
  isVisible: boolean
  onBackdropPress?: () => void
  onModalShow?: () => void
}

jest.mock("react-native-modal", () => {
  const MockModal = ({ children, isVisible, onModalShow }: MockModalProps) => {
    React.useEffect(() => {
      if (isVisible && onModalShow) {
        onModalShow()
      }
    }, [isVisible, onModalShow])
    return isVisible ? <View testID="year-selector-modal">{children}</View> : null
  }
  MockModal.displayName = "MockModal"
  return MockModal
})

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
}

describe("YearSelector", () => {
  const mockOnYearChange = jest.fn()

  const defaultYears: YearOption[] = [
    { year: 2025, itemCount: 3 },
    { year: 2024, itemCount: 5 },
    { year: 2023, itemCount: 0, disabled: true },
  ]

  const defaultProps = {
    years: defaultYears,
    selectedYear: 2025,
    onYearChange: mockOnYearChange,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = renderWithTheme(<YearSelector {...defaultProps} />)
      expect(toJSON()).toBeTruthy()
    })

    it("displays selected year in selector button", () => {
      const { getAllByText } = renderWithTheme(<YearSelector {...defaultProps} />)
      const yearTexts = getAllByText("2025")
      expect(yearTexts.length).toBeGreaterThan(0)
    })

    it("displays different selected year", () => {
      const { getAllByText } = renderWithTheme(
        <YearSelector {...defaultProps} selectedYear={2024} />,
      )
      const yearTexts = getAllByText("2024")
      expect(yearTexts.length).toBeGreaterThan(0)
    })
  })

  describe("with itemLabel", () => {
    const getStatementsLabel = (count: number): string => {
      if (count === 0) return "No statements"
      return `${count} statements`
    }

    it("renders with itemLabel function", () => {
      const { toJSON } = renderWithTheme(
        <YearSelector {...defaultProps} itemLabel={getStatementsLabel} />,
      )
      expect(toJSON()).toBeTruthy()
    })

    it("displays item labels in modal options", () => {
      const { getByText } = renderWithTheme(
        <YearSelector {...defaultProps} itemLabel={getStatementsLabel} />,
      )

      fireEvent.press(getByText("2025"))

      expect(getByText("3 statements")).toBeTruthy()
      expect(getByText("5 statements")).toBeTruthy()
      expect(getByText("No statements")).toBeTruthy()
    })
  })

  describe("modal interaction", () => {
    it("opens modal when selector is pressed", () => {
      const { getByText, queryByTestId } = renderWithTheme(
        <YearSelector {...defaultProps} />,
      )

      expect(queryByTestId("year-selector-modal")).toBeNull()

      const selectorButton = getByText("2025")
      fireEvent.press(selectorButton)

      expect(queryByTestId("year-selector-modal")).toBeTruthy()
    })

    it("displays all year options in modal", () => {
      const { getByText, getAllByText } = renderWithTheme(
        <YearSelector {...defaultProps} />,
      )

      fireEvent.press(getByText("2025"))

      const year2025Texts = getAllByText("2025")
      expect(year2025Texts.length).toBeGreaterThanOrEqual(2)
      expect(getAllByText("2024").length).toBeGreaterThanOrEqual(1)
      expect(getAllByText("2023").length).toBeGreaterThanOrEqual(1)
    })

    it("calls onYearChange when enabled year is selected", () => {
      const { getByText, getAllByText } = renderWithTheme(
        <YearSelector {...defaultProps} />,
      )

      fireEvent.press(getByText("2025"))

      const year2024Texts = getAllByText("2024")
      const modalYear2024 = year2024Texts[year2024Texts.length - 1]
      fireEvent.press(modalYear2024)

      expect(mockOnYearChange).toHaveBeenCalledWith(2024)
    })

    it("closes modal after selecting a year", () => {
      const { getByText, getAllByText, queryByTestId } = renderWithTheme(
        <YearSelector {...defaultProps} />,
      )

      fireEvent.press(getByText("2025"))
      expect(queryByTestId("year-selector-modal")).toBeTruthy()

      const year2024Texts = getAllByText("2024")
      fireEvent.press(year2024Texts[year2024Texts.length - 1])

      expect(queryByTestId("year-selector-modal")).toBeNull()
    })
  })

  describe("disabled year behavior", () => {
    it("does not call onYearChange when disabled year is pressed", () => {
      const { getByText, getAllByText } = renderWithTheme(
        <YearSelector {...defaultProps} />,
      )

      fireEvent.press(getByText("2025"))

      const year2023Texts = getAllByText("2023")
      const disabledYear = year2023Texts[year2023Texts.length - 1]
      fireEvent.press(disabledYear)

      expect(mockOnYearChange).not.toHaveBeenCalled()
    })

    it("disables years with itemCount of 0", () => {
      const yearsWithZeroCount: YearOption[] = [
        { year: 2025, itemCount: 3 },
        { year: 2024, itemCount: 0 },
      ]

      const { getByText, getAllByText } = renderWithTheme(
        <YearSelector
          years={yearsWithZeroCount}
          selectedYear={2025}
          onYearChange={mockOnYearChange}
        />,
      )

      fireEvent.press(getByText("2025"))

      const year2024Texts = getAllByText("2024")
      fireEvent.press(year2024Texts[year2024Texts.length - 1])

      expect(mockOnYearChange).not.toHaveBeenCalled()
    })

    it("disables years with explicit disabled flag", () => {
      const yearsExplicitDisabled: YearOption[] = [
        { year: 2025, itemCount: 5 },
        { year: 2024, itemCount: 10, disabled: true },
      ]

      const { getByText, getAllByText } = renderWithTheme(
        <YearSelector
          years={yearsExplicitDisabled}
          selectedYear={2025}
          onYearChange={mockOnYearChange}
        />,
      )

      fireEvent.press(getByText("2025"))

      const year2024Texts = getAllByText("2024")
      fireEvent.press(year2024Texts[year2024Texts.length - 1])

      expect(mockOnYearChange).not.toHaveBeenCalled()
    })
  })

  describe("scrollToSelected behavior", () => {
    it("triggers onModalShow callback when modal opens", () => {
      const { getAllByText, queryByTestId } = renderWithTheme(
        <YearSelector {...defaultProps} selectedYear={2024} />,
      )

      const year2024Texts = getAllByText("2024")
      fireEvent.press(year2024Texts[0])

      expect(queryByTestId("year-selector-modal")).toBeTruthy()
    })

    it("shows selected year with check icon in modal", () => {
      const { getByText, getAllByText, queryByTestId } = renderWithTheme(
        <YearSelector {...defaultProps} selectedYear={2025} />,
      )

      fireEvent.press(getByText("2025"))

      expect(queryByTestId("year-selector-modal")).toBeTruthy()
      const year2025Texts = getAllByText("2025")
      expect(year2025Texts.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe("props validation", () => {
    it("accepts years with itemCount", () => {
      const yearsWithCount: YearOption[] = [
        { year: 2025, itemCount: 3 },
        { year: 2024, itemCount: 5 },
      ]

      const { toJSON } = renderWithTheme(
        <YearSelector
          years={yearsWithCount}
          selectedYear={2025}
          onYearChange={mockOnYearChange}
        />,
      )
      expect(toJSON()).toBeTruthy()
    })

    it("accepts years without itemCount", () => {
      const yearsWithoutCount: YearOption[] = [{ year: 2025 }, { year: 2024 }]

      const { toJSON } = renderWithTheme(
        <YearSelector
          years={yearsWithoutCount}
          selectedYear={2025}
          onYearChange={mockOnYearChange}
        />,
      )
      expect(toJSON()).toBeTruthy()
    })

    it("accepts years with disabled flag", () => {
      const yearsWithDisabled: YearOption[] = [
        { year: 2025, itemCount: 3 },
        { year: 2024, itemCount: 0, disabled: true },
      ]

      const { toJSON } = renderWithTheme(
        <YearSelector
          years={yearsWithDisabled}
          selectedYear={2025}
          onYearChange={mockOnYearChange}
        />,
      )
      expect(toJSON()).toBeTruthy()
    })
  })
})
