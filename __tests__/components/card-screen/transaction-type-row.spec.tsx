import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { TransactionTypeRow } from "@app/components/card-screen"
import TypesafeI18n from "@app/i18n/i18n-react"
import theme from "@app/rne-theme/theme"

jest.mock("react-native-reanimated", () => {
  const RNView = jest.requireActual<typeof import("react-native")>("react-native").View
  return {
    __esModule: true,
    default: {
      View: RNView,
      createAnimatedComponent: (component: React.ComponentType) => component,
    },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    withTiming: (value: number) => value,
    interpolateColor: () => "transparent",
  }
})

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      <TypesafeI18n locale="en">{component}</TypesafeI18n>
    </ThemeProvider>,
  )
}

describe("TransactionTypeRow", () => {
  const mockOnValueChange = jest.fn()

  const defaultProps = {
    title: "E-commerce",
    description: "Online purchases",
    value: true,
    onValueChange: mockOnValueChange,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = renderWithTheme(<TransactionTypeRow {...defaultProps} />)
      expect(toJSON()).toBeTruthy()
    })

    it("displays title correctly", () => {
      const { getByText } = renderWithTheme(<TransactionTypeRow {...defaultProps} />)
      expect(getByText("E-commerce")).toBeTruthy()
    })

    it("displays description correctly", () => {
      const { getByText } = renderWithTheme(<TransactionTypeRow {...defaultProps} />)
      expect(getByText("Online purchases")).toBeTruthy()
    })

    it("renders with value true", () => {
      const { toJSON } = renderWithTheme(
        <TransactionTypeRow {...defaultProps} value={true} />,
      )
      expect(toJSON()).toBeTruthy()
    })

    it("renders with value false", () => {
      const { toJSON } = renderWithTheme(
        <TransactionTypeRow {...defaultProps} value={false} />,
      )
      expect(toJSON()).toBeTruthy()
    })
  })

  describe("interaction", () => {
    it("calls onValueChange when switch is toggled", () => {
      const { getByRole } = renderWithTheme(<TransactionTypeRow {...defaultProps} />)

      const switchElement = getByRole("switch")
      fireEvent(switchElement, "pressIn")

      expect(mockOnValueChange).toHaveBeenCalled()
    })
  })
})
