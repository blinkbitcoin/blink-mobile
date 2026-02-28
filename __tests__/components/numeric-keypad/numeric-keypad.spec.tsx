import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { NumericKeypad, NumericKey } from "@app/components/numeric-keypad"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        primary: "#F7931A",
        grey3: "#999999",
        grey4: "#CCCCCC",
        black: "#000000",
      },
    },
  }),
  makeStyles: () => () => ({
    container: {},
    keyRow: {},
    key: {},
    keyPressed: {},
    keyDisabled: {},
    keyText: {},
    keyTextDisabled: {},
  }),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name, color }: { name: string; size: number; color: string }) => (
    <View testID={`galoy-icon-${name}`} accessibilityHint={color}>
      <RNText>{name}</RNText>
    </View>
  ),
}))

describe("NumericKeypad", () => {
  const mockOnKeyPress = jest.fn()

  const defaultProps = {
    onKeyPress: mockOnKeyPress,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<NumericKeypad {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("renders all numeric keys 0-9", () => {
      const { getByTestId } = render(<NumericKeypad {...defaultProps} />)

      const numericKeys = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      numericKeys.forEach((key) => {
        expect(getByTestId(`NumericKey-${key}`)).toBeTruthy()
      })
    })

    it("renders decimal key", () => {
      const { getByTestId } = render(<NumericKeypad {...defaultProps} />)

      expect(getByTestId("NumericKey-.")).toBeTruthy()
    })

    it("renders backspace key", () => {
      const { getByTestId } = render(<NumericKeypad {...defaultProps} />)

      expect(getByTestId("NumericKey-⌫")).toBeTruthy()
    })

    it("renders backspace icon", () => {
      const { getByTestId } = render(<NumericKeypad {...defaultProps} />)

      expect(getByTestId("galoy-icon-back-space")).toBeTruthy()
    })

    it("displays numeric values on keys", () => {
      const { getByText } = render(<NumericKeypad {...defaultProps} />)

      const numericValues = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      numericValues.forEach((value) => {
        expect(getByText(String(value))).toBeTruthy()
      })
    })

    it("displays decimal point", () => {
      const { getByText } = render(<NumericKeypad {...defaultProps} />)

      expect(getByText(".")).toBeTruthy()
    })
  })

  describe("key press interactions", () => {
    it("calls onKeyPress with correct value when key 1 is pressed", () => {
      const { getByTestId } = render(<NumericKeypad {...defaultProps} />)

      fireEvent.press(getByTestId("NumericKey-1"))

      expect(mockOnKeyPress).toHaveBeenCalledWith("1")
    })

    it("calls onKeyPress with correct value when key 0 is pressed", () => {
      const { getByTestId } = render(<NumericKeypad {...defaultProps} />)

      fireEvent.press(getByTestId("NumericKey-0"))

      expect(mockOnKeyPress).toHaveBeenCalledWith("0")
    })

    it("calls onKeyPress with correct value when decimal is pressed", () => {
      const { getByTestId } = render(<NumericKeypad {...defaultProps} />)

      fireEvent.press(getByTestId("NumericKey-."))

      expect(mockOnKeyPress).toHaveBeenCalledWith(".")
    })

    it("calls onKeyPress with correct value when backspace is pressed", () => {
      const { getByTestId } = render(<NumericKeypad {...defaultProps} />)

      fireEvent.press(getByTestId("NumericKey-⌫"))

      expect(mockOnKeyPress).toHaveBeenCalledWith("⌫")
    })

    it("calls onKeyPress for each key press", () => {
      const { getByTestId } = render(<NumericKeypad {...defaultProps} />)

      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-2"))
      fireEvent.press(getByTestId("NumericKey-3"))

      expect(mockOnKeyPress).toHaveBeenCalledTimes(3)
      expect(mockOnKeyPress).toHaveBeenNthCalledWith(1, "1")
      expect(mockOnKeyPress).toHaveBeenNthCalledWith(2, "2")
      expect(mockOnKeyPress).toHaveBeenNthCalledWith(3, "3")
    })
  })

  describe("disabled state", () => {
    it("does not call onKeyPress when disabled", () => {
      const { getByTestId } = render(<NumericKeypad {...defaultProps} disabled={true} />)

      fireEvent.press(getByTestId("NumericKey-1"))

      expect(mockOnKeyPress).not.toHaveBeenCalled()
    })

    it("does not call onKeyPress on any key when disabled", () => {
      const { getByTestId } = render(<NumericKeypad {...defaultProps} disabled={true} />)

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-."))
      fireEvent.press(getByTestId("NumericKey-⌫"))

      expect(mockOnKeyPress).not.toHaveBeenCalled()
    })
  })

  describe("disabled keys", () => {
    it("does not call onKeyPress for disabled decimal key", () => {
      const { getByTestId } = render(
        <NumericKeypad {...defaultProps} disabledKeys={[NumericKey.Decimal]} />,
      )

      fireEvent.press(getByTestId("NumericKey-."))

      expect(mockOnKeyPress).not.toHaveBeenCalled()
    })

    it("does not call onKeyPress for disabled backspace key", () => {
      const { getByTestId } = render(
        <NumericKeypad {...defaultProps} disabledKeys={[NumericKey.Backspace]} />,
      )

      fireEvent.press(getByTestId("NumericKey-⌫"))

      expect(mockOnKeyPress).not.toHaveBeenCalled()
    })

    it("does not call onKeyPress for disabled numeric key", () => {
      const { getByTestId } = render(
        <NumericKeypad {...defaultProps} disabledKeys={[NumericKey[5]]} />,
      )

      fireEvent.press(getByTestId("NumericKey-5"))

      expect(mockOnKeyPress).not.toHaveBeenCalled()
    })

    it("allows pressing non-disabled keys when some keys are disabled", () => {
      const { getByTestId } = render(
        <NumericKeypad {...defaultProps} disabledKeys={[NumericKey.Decimal]} />,
      )

      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-2"))

      expect(mockOnKeyPress).toHaveBeenCalledTimes(2)
    })

    it("handles multiple disabled keys", () => {
      const { getByTestId } = render(
        <NumericKeypad
          {...defaultProps}
          disabledKeys={[NumericKey.Decimal, NumericKey.Backspace, NumericKey[0]]}
        />,
      )

      fireEvent.press(getByTestId("NumericKey-."))
      fireEvent.press(getByTestId("NumericKey-⌫"))
      fireEvent.press(getByTestId("NumericKey-0"))

      expect(mockOnKeyPress).not.toHaveBeenCalled()

      fireEvent.press(getByTestId("NumericKey-1"))

      expect(mockOnKeyPress).toHaveBeenCalledWith("1")
    })
  })

  describe("NumericKey constant", () => {
    it("has correct numeric values", () => {
      expect(NumericKey[0]).toBe("0")
      expect(NumericKey[1]).toBe("1")
      expect(NumericKey[9]).toBe("9")
    })

    it("has correct special values", () => {
      expect(NumericKey.Decimal).toBe(".")
      expect(NumericKey.Backspace).toBe("⌫")
    })
  })

  describe("key layout", () => {
    it("renders 12 keys total", () => {
      const { getAllByTestId } = render(<NumericKeypad {...defaultProps} />)

      const keys = getAllByTestId(/^NumericKey-/)
      expect(keys).toHaveLength(12)
    })
  })

  describe("backspace icon color", () => {
    it("renders backspace icon with primary color when not disabled", () => {
      const { getByTestId } = render(<NumericKeypad {...defaultProps} />)

      const icon = getByTestId("galoy-icon-back-space")
      expect(icon.props.accessibilityHint).toBe("#F7931A")
    })

    it("renders backspace icon with grey color when disabled", () => {
      const { getByTestId } = render(<NumericKeypad {...defaultProps} disabled={true} />)

      const icon = getByTestId("galoy-icon-back-space")
      expect(icon.props.accessibilityHint).toBe("#999999")
    })

    it("renders backspace icon with grey color when in disabledKeys", () => {
      const { getByTestId } = render(
        <NumericKeypad {...defaultProps} disabledKeys={[NumericKey.Backspace]} />,
      )

      const icon = getByTestId("galoy-icon-back-space")
      expect(icon.props.accessibilityHint).toBe("#999999")
    })
  })

  describe("rerender", () => {
    it("handles onKeyPress callback change", () => {
      const newMockOnKeyPress = jest.fn()
      const { getByTestId, rerender } = render(<NumericKeypad {...defaultProps} />)

      fireEvent.press(getByTestId("NumericKey-1"))
      expect(mockOnKeyPress).toHaveBeenCalledTimes(1)

      rerender(<NumericKeypad onKeyPress={newMockOnKeyPress} />)

      fireEvent.press(getByTestId("NumericKey-2"))
      expect(newMockOnKeyPress).toHaveBeenCalledWith("2")
    })

    it("handles disabled state change", () => {
      const { getByTestId, rerender } = render(<NumericKeypad {...defaultProps} />)

      fireEvent.press(getByTestId("NumericKey-1"))
      expect(mockOnKeyPress).toHaveBeenCalledTimes(1)

      rerender(<NumericKeypad {...defaultProps} disabled={true} />)

      fireEvent.press(getByTestId("NumericKey-2"))
      expect(mockOnKeyPress).toHaveBeenCalledTimes(1)
    })

    it("handles disabledKeys change", () => {
      const { getByTestId, rerender } = render(<NumericKeypad {...defaultProps} />)

      fireEvent.press(getByTestId("NumericKey-."))
      expect(mockOnKeyPress).toHaveBeenCalledTimes(1)

      rerender(<NumericKeypad {...defaultProps} disabledKeys={[NumericKey.Decimal]} />)

      fireEvent.press(getByTestId("NumericKey-."))
      expect(mockOnKeyPress).toHaveBeenCalledTimes(1)
    })
  })
})
