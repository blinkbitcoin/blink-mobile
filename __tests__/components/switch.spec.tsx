import React from "react"
import { View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { Switch } from "@app/components/atomic/switch"
import TypesafeI18n from "@app/i18n/i18n-react"
import theme from "@app/rne-theme/theme"

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: {
    View,
  },
  useSharedValue: (initial: number) => ({ value: initial }),
  useAnimatedStyle: () => ({}),
  withTiming: (value: number) => value,
  interpolateColor: () => "transparent",
}))

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      <TypesafeI18n locale="en">{component}</TypesafeI18n>
    </ThemeProvider>,
  )
}

describe("Switch", () => {
  const mockOnValueChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = renderWithTheme(
        <Switch value={false} onValueChange={mockOnValueChange} />,
      )

      expect(toJSON()).toBeTruthy()
    })

    it("renders with value true", () => {
      const { toJSON } = renderWithTheme(
        <Switch value={true} onValueChange={mockOnValueChange} />,
      )

      expect(toJSON()).toBeTruthy()
    })

    it("renders with value false", () => {
      const { toJSON } = renderWithTheme(
        <Switch value={false} onValueChange={mockOnValueChange} />,
      )

      expect(toJSON()).toBeTruthy()
    })

    it("renders in disabled state", () => {
      const { toJSON } = renderWithTheme(
        <Switch value={false} onValueChange={mockOnValueChange} disabled />,
      )

      expect(toJSON()).toBeTruthy()
    })
  })

  describe("interactions", () => {
    it("calls onValueChange with true when pressed while value is false", () => {
      const { getByTestId } = renderWithTheme(
        <Switch value={false} onValueChange={mockOnValueChange} testID="switch" />,
      )

      const pressable = getByTestId("switch")
      fireEvent.press(pressable)

      expect(mockOnValueChange).toHaveBeenCalledWith(true)
      expect(mockOnValueChange).toHaveBeenCalledTimes(1)
    })

    it("calls onValueChange with false when pressed while value is true", () => {
      const { getByTestId } = renderWithTheme(
        <Switch value={true} onValueChange={mockOnValueChange} testID="switch" />,
      )

      const pressable = getByTestId("switch")
      fireEvent.press(pressable)

      expect(mockOnValueChange).toHaveBeenCalledWith(false)
      expect(mockOnValueChange).toHaveBeenCalledTimes(1)
    })

    it("does not call onValueChange when disabled and pressed", () => {
      const { getByTestId } = renderWithTheme(
        <Switch
          value={false}
          onValueChange={mockOnValueChange}
          disabled
          testID="switch"
        />,
      )

      const pressable = getByTestId("switch")
      fireEvent.press(pressable)

      expect(mockOnValueChange).not.toHaveBeenCalled()
    })

    it("toggles correctly on multiple presses", () => {
      const { getByTestId, rerender } = renderWithTheme(
        <Switch value={false} onValueChange={mockOnValueChange} testID="switch" />,
      )

      const pressable = getByTestId("switch")

      fireEvent.press(pressable)
      expect(mockOnValueChange).toHaveBeenCalledWith(true)

      rerender(
        <ThemeProvider theme={theme}>
          <TypesafeI18n locale="en">
            <Switch value={true} onValueChange={mockOnValueChange} testID="switch" />
          </TypesafeI18n>
        </ThemeProvider>,
      )

      fireEvent.press(pressable)
      expect(mockOnValueChange).toHaveBeenCalledWith(false)

      expect(mockOnValueChange).toHaveBeenCalledTimes(2)
    })
  })

  describe("disabled state", () => {
    it("does not respond to press when disabled is true", () => {
      const { getByTestId } = renderWithTheme(
        <Switch
          value={true}
          onValueChange={mockOnValueChange}
          disabled={true}
          testID="switch"
        />,
      )

      const pressable = getByTestId("switch")
      fireEvent.press(pressable)

      expect(mockOnValueChange).not.toHaveBeenCalled()
    })

    it("responds to press when disabled is false", () => {
      const { getByTestId } = renderWithTheme(
        <Switch
          value={true}
          onValueChange={mockOnValueChange}
          disabled={false}
          testID="switch"
        />,
      )

      const pressable = getByTestId("switch")
      fireEvent.press(pressable)

      expect(mockOnValueChange).toHaveBeenCalledWith(false)
    })

    it("responds to press when disabled is not provided (default false)", () => {
      const { getByTestId } = renderWithTheme(
        <Switch value={false} onValueChange={mockOnValueChange} testID="switch" />,
      )

      const pressable = getByTestId("switch")
      fireEvent.press(pressable)

      expect(mockOnValueChange).toHaveBeenCalledWith(true)
    })
  })

  describe("callback behavior", () => {
    it("always inverts the current value on press", () => {
      const { getByTestId, rerender } = renderWithTheme(
        <Switch value={false} onValueChange={mockOnValueChange} testID="switch" />,
      )

      const pressable = getByTestId("switch")

      fireEvent.press(pressable)
      expect(mockOnValueChange).toHaveBeenLastCalledWith(true)

      rerender(
        <ThemeProvider theme={theme}>
          <TypesafeI18n locale="en">
            <Switch value={true} onValueChange={mockOnValueChange} testID="switch" />
          </TypesafeI18n>
        </ThemeProvider>,
      )
      fireEvent.press(pressable)
      expect(mockOnValueChange).toHaveBeenLastCalledWith(false)

      rerender(
        <ThemeProvider theme={theme}>
          <TypesafeI18n locale="en">
            <Switch value={false} onValueChange={mockOnValueChange} testID="switch" />
          </TypesafeI18n>
        </ThemeProvider>,
      )
      fireEvent.press(pressable)
      expect(mockOnValueChange).toHaveBeenLastCalledWith(true)
    })

    it("calls the correct callback when callback reference changes", () => {
      const firstCallback = jest.fn()
      const secondCallback = jest.fn()

      const { getByTestId, rerender } = renderWithTheme(
        <Switch value={false} onValueChange={firstCallback} testID="switch" />,
      )

      const pressable = getByTestId("switch")

      fireEvent.press(pressable)
      expect(firstCallback).toHaveBeenCalledWith(true)
      expect(secondCallback).not.toHaveBeenCalled()

      rerender(
        <ThemeProvider theme={theme}>
          <TypesafeI18n locale="en">
            <Switch value={false} onValueChange={secondCallback} testID="switch" />
          </TypesafeI18n>
        </ThemeProvider>,
      )

      fireEvent.press(pressable)
      expect(secondCallback).toHaveBeenCalledWith(true)
      expect(firstCallback).toHaveBeenCalledTimes(1)
    })
  })
})
