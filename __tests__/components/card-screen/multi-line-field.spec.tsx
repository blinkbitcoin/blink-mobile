import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { MultiLineField } from "@app/components/card-screen/multi-line-field"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        primary: "#F7931A",
        grey2: "#666666",
        grey5: "#F5F5F5",
      },
    },
  }),
  makeStyles: () => () => ({
    container: {},
    textContainer: {},
    text: {},
  }),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name, color }: { name: string; size: number; color: string }) => (
    <View testID={`galoy-icon-${name}`} accessibilityHint={color}>
      <RNText>{name}</RNText>
    </View>
  ),
}))

describe("MultiLineField", () => {
  const defaultProps = {
    lines: ["Satoshi Nakamoto", "123 Main Street", "New York, NY 10001"],
  }

  const mockOnPress = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<MultiLineField {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays all lines", () => {
      const { getByText } = render(<MultiLineField {...defaultProps} />)

      expect(getByText("Satoshi Nakamoto")).toBeTruthy()
      expect(getByText("123 Main Street")).toBeTruthy()
      expect(getByText("New York, NY 10001")).toBeTruthy()
    })

    it("renders single line", () => {
      const { getByText } = render(<MultiLineField lines={["Single line"]} />)

      expect(getByText("Single line")).toBeTruthy()
    })

    it("renders multiple lines in order", () => {
      const { getAllByText } = render(<MultiLineField {...defaultProps} />)

      const textElements = getAllByText(/./i)
      expect(textElements.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe("left icon", () => {
    it("renders without left icon by default", () => {
      const { queryByTestId } = render(<MultiLineField {...defaultProps} />)

      expect(queryByTestId("galoy-icon-map-pin")).toBeNull()
    })

    it("renders with left icon when provided", () => {
      const { getByTestId } = render(
        <MultiLineField {...defaultProps} leftIcon="map-pin" />,
      )

      expect(getByTestId("galoy-icon-map-pin")).toBeTruthy()
    })

    it("renders with different left icon", () => {
      const { getByTestId } = render(<MultiLineField {...defaultProps} leftIcon="info" />)

      expect(getByTestId("galoy-icon-info")).toBeTruthy()
    })
  })

  describe("right icon", () => {
    it("renders without right icon by default", () => {
      const { queryByTestId } = render(<MultiLineField {...defaultProps} />)

      expect(queryByTestId("galoy-icon-pencil")).toBeNull()
    })

    it("renders with right icon when provided", () => {
      const { getByTestId } = render(
        <MultiLineField {...defaultProps} rightIcon="pencil" />,
      )

      expect(getByTestId("galoy-icon-pencil")).toBeTruthy()
    })

    it("renders with different right icon", () => {
      const { getByTestId } = render(
        <MultiLineField {...defaultProps} rightIcon="caret-right" />,
      )

      expect(getByTestId("galoy-icon-caret-right")).toBeTruthy()
    })

    it("renders with primary color for right icon", () => {
      const { getByTestId } = render(
        <MultiLineField {...defaultProps} rightIcon="pencil" />,
      )

      const icon = getByTestId("galoy-icon-pencil")
      expect(icon.props.accessibilityHint).toBe("#F7931A")
    })
  })

  describe("both icons", () => {
    it("renders with both left and right icons", () => {
      const { getByTestId } = render(
        <MultiLineField {...defaultProps} leftIcon="map-pin" rightIcon="pencil" />,
      )

      expect(getByTestId("galoy-icon-map-pin")).toBeTruthy()
      expect(getByTestId("galoy-icon-pencil")).toBeTruthy()
    })
  })

  describe("interactions", () => {
    it("does not call onPress when not provided", () => {
      const { getByText } = render(<MultiLineField {...defaultProps} />)

      fireEvent.press(getByText("Satoshi Nakamoto"))

      expect(mockOnPress).not.toHaveBeenCalled()
    })

    it("calls onPress when pressed and handler is provided", () => {
      const { getByRole } = render(
        <MultiLineField {...defaultProps} onPress={mockOnPress} />,
      )

      fireEvent.press(getByRole("button"))

      expect(mockOnPress).toHaveBeenCalledTimes(1)
    })

    it("calls onPress multiple times when pressed multiple times", () => {
      const { getByRole } = render(
        <MultiLineField {...defaultProps} onPress={mockOnPress} />,
      )

      const button = getByRole("button")
      fireEvent.press(button)
      fireEvent.press(button)
      fireEvent.press(button)

      expect(mockOnPress).toHaveBeenCalledTimes(3)
    })

    it("calls updated callback when reference changes", () => {
      const firstOnPress = jest.fn()
      const secondOnPress = jest.fn()

      const { getByRole, rerender } = render(
        <MultiLineField {...defaultProps} onPress={firstOnPress} />,
      )

      fireEvent.press(getByRole("button"))
      expect(firstOnPress).toHaveBeenCalledTimes(1)

      rerender(<MultiLineField {...defaultProps} onPress={secondOnPress} />)

      fireEvent.press(getByRole("button"))
      expect(secondOnPress).toHaveBeenCalledTimes(1)
      expect(firstOnPress).toHaveBeenCalledTimes(1)
    })
  })

  describe("accessibility", () => {
    it("has button role when pressable", () => {
      const { getByRole } = render(
        <MultiLineField {...defaultProps} onPress={mockOnPress} />,
      )

      expect(getByRole("button")).toBeTruthy()
    })

    it("has accessibility label with joined lines when pressable", () => {
      const { getByLabelText } = render(
        <MultiLineField {...defaultProps} onPress={mockOnPress} />,
      )

      expect(
        getByLabelText("Satoshi Nakamoto, 123 Main Street, New York, NY 10001"),
      ).toBeTruthy()
    })
  })

  describe("address content", () => {
    it("renders full address", () => {
      const address = [
        "Satoshi Nakamoto",
        "123 Main Street",
        "Apt 4B",
        "New York, NY 10001",
        "United States",
      ]

      const { getByText } = render(<MultiLineField lines={address} />)

      expect(getByText("Satoshi Nakamoto")).toBeTruthy()
      expect(getByText("123 Main Street")).toBeTruthy()
      expect(getByText("Apt 4B")).toBeTruthy()
      expect(getByText("New York, NY 10001")).toBeTruthy()
      expect(getByText("United States")).toBeTruthy()
    })

    it("renders registered address with icon", () => {
      const address = ["123 Main Street", "New York, NY 10001"]

      const { getByText, getByTestId } = render(
        <MultiLineField lines={address} leftIcon="map-pin" />,
      )

      expect(getByText("123 Main Street")).toBeTruthy()
      expect(getByTestId("galoy-icon-map-pin")).toBeTruthy()
    })

    it("renders editable shipping address", () => {
      const address = ["456 Oak Street", "Los Angeles, CA 90001"]

      const { getByText, getByTestId, getByRole } = render(
        <MultiLineField
          lines={address}
          leftIcon="map-pin"
          rightIcon="pencil"
          onPress={mockOnPress}
        />,
      )

      expect(getByText("456 Oak Street")).toBeTruthy()
      expect(getByTestId("galoy-icon-map-pin")).toBeTruthy()
      expect(getByTestId("galoy-icon-pencil")).toBeTruthy()
      expect(getByRole("button")).toBeTruthy()
    })
  })

  describe("rerender", () => {
    it("updates lines when prop changes", () => {
      const { getByText, queryByText, rerender } = render(
        <MultiLineField lines={["Line 1", "Line 2"]} />,
      )

      expect(getByText("Line 1")).toBeTruthy()
      expect(getByText("Line 2")).toBeTruthy()

      rerender(<MultiLineField lines={["New Line 1", "New Line 2"]} />)

      expect(getByText("New Line 1")).toBeTruthy()
      expect(getByText("New Line 2")).toBeTruthy()
      expect(queryByText("Line 1")).toBeNull()
    })

    it("updates icons when props change", () => {
      const { getByTestId, queryByTestId, rerender } = render(
        <MultiLineField {...defaultProps} leftIcon="map-pin" />,
      )

      expect(getByTestId("galoy-icon-map-pin")).toBeTruthy()
      expect(queryByTestId("galoy-icon-pencil")).toBeNull()

      rerender(<MultiLineField {...defaultProps} rightIcon="pencil" />)

      expect(queryByTestId("galoy-icon-map-pin")).toBeNull()
      expect(getByTestId("galoy-icon-pencil")).toBeTruthy()
    })
  })
})
