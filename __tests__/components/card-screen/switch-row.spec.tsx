import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { SwitchRow } from "@app/components/card-screen"
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

describe("SwitchRow", () => {
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
      const { toJSON } = renderWithTheme(<SwitchRow {...defaultProps} />)
      expect(toJSON()).toBeTruthy()
    })

    it("displays title correctly", () => {
      const { getByText } = renderWithTheme(<SwitchRow {...defaultProps} />)
      expect(getByText("E-commerce")).toBeTruthy()
    })

    it("displays description correctly", () => {
      const { getByText } = renderWithTheme(<SwitchRow {...defaultProps} />)
      expect(getByText("Online purchases")).toBeTruthy()
    })

    it("renders with value true", () => {
      const { toJSON } = renderWithTheme(<SwitchRow {...defaultProps} value={true} />)
      expect(toJSON()).toBeTruthy()
    })

    it("renders with value false", () => {
      const { toJSON } = renderWithTheme(<SwitchRow {...defaultProps} value={false} />)
      expect(toJSON()).toBeTruthy()
    })
  })

  describe("interaction", () => {
    it("calls onValueChange when switch is toggled", () => {
      const { getByRole } = renderWithTheme(<SwitchRow {...defaultProps} />)

      const switchElement = getByRole("switch")
      fireEvent(switchElement, "pressIn")

      expect(mockOnValueChange).toHaveBeenCalled()
    })
  })

  describe("optional props", () => {
    it("renders with only title", () => {
      const { getByText } = renderWithTheme(<SwitchRow title="Toggle" />)
      expect(getByText("Toggle")).toBeTruthy()
    })

    it("defaults value to false", () => {
      const { getByRole } = renderWithTheme(<SwitchRow title="Toggle" />)
      const switchElement = getByRole("switch")
      expect(switchElement.props.accessibilityState.checked).toBe(false)
    })

    it("renders without description", () => {
      const { getByText, queryByText } = renderWithTheme(<SwitchRow title="Toggle" />)
      expect(getByText("Toggle")).toBeTruthy()
      expect(queryByText("Online purchases")).toBeNull()
    })

    it("handles toggle without onValueChange prop", () => {
      const { getByRole } = renderWithTheme(<SwitchRow title="Toggle" />)
      const switchElement = getByRole("switch")
      fireEvent(switchElement, "pressIn")
    })
  })
})
