import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { ActionField } from "@app/components/action-field"

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name, size }: { name: string; size: number }) => (
    <View testID={`icon-${name}`} accessibilityLabel={`icon-size-${size}`} />
  ),
}))

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        primary: "#F7931A",
        black: "#000000",
        grey5: "#F5F5F5",
      },
    },
  }),
  makeStyles: () => () => ({
    container: {},
    label: {},
    valueContainer: {},
    value: {},
    actionButton: {},
  }),
}))

describe("ActionField", () => {
  const mockOnAction = jest.fn()

  const defaultProps = {
    value: "Test value",
    onAction: mockOnAction,
    icon: "copy-paste" as const,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<ActionField {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays the value correctly", () => {
      const { getByText } = render(<ActionField {...defaultProps} />)

      expect(getByText("Test value")).toBeTruthy()
    })

    it("displays the icon", () => {
      const { getByTestId } = render(<ActionField {...defaultProps} />)

      expect(getByTestId("icon-copy-paste")).toBeTruthy()
    })

    it("renders with different icon", () => {
      const { getByTestId } = render(<ActionField {...defaultProps} icon="pencil" />)

      expect(getByTestId("icon-pencil")).toBeTruthy()
    })

    it("does not display label when not provided", () => {
      const { queryByText } = render(<ActionField {...defaultProps} />)

      expect(queryByText("Label")).toBeNull()
    })
  })

  describe("with label", () => {
    it("displays the label when provided", () => {
      const { getByText } = render(<ActionField {...defaultProps} label="Test Label" />)

      expect(getByText("Test Label")).toBeTruthy()
    })

    it("displays both label and value", () => {
      const { getByText } = render(
        <ActionField {...defaultProps} label="Card Number" value="1234 5678" />,
      )

      expect(getByText("Card Number")).toBeTruthy()
      expect(getByText("1234 5678")).toBeTruthy()
    })
  })

  describe("interactions", () => {
    it("calls onAction when pressed", () => {
      const { getByText } = render(<ActionField {...defaultProps} />)

      fireEvent.press(getByText("Test value"))

      expect(mockOnAction).toHaveBeenCalledTimes(1)
    })

    it("calls onAction multiple times on multiple presses", () => {
      const { getByText } = render(<ActionField {...defaultProps} />)

      fireEvent.press(getByText("Test value"))
      fireEvent.press(getByText("Test value"))
      fireEvent.press(getByText("Test value"))

      expect(mockOnAction).toHaveBeenCalledTimes(3)
    })
  })

  describe("different values", () => {
    it("renders with card number format", () => {
      const { getByText } = render(
        <ActionField {...defaultProps} value="4111 1111 1111 1111" />,
      )

      expect(getByText("4111 1111 1111 1111")).toBeTruthy()
    })

    it("renders with date format", () => {
      const { getByText } = render(<ActionField {...defaultProps} value="12/29" />)

      expect(getByText("12/29")).toBeTruthy()
    })

    it("renders with CVV format", () => {
      const { getByText } = render(<ActionField {...defaultProps} value="123" />)

      expect(getByText("123")).toBeTruthy()
    })

    it("renders with empty value", () => {
      const { toJSON } = render(<ActionField {...defaultProps} value="" />)

      expect(toJSON()).toBeTruthy()
    })
  })
})
