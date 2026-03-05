import React from "react"
import { Text as RNText } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { CheckboxRow } from "@app/components/card-screen/checkbox-row"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        white: "#FFFFFF",
        primary: "#0066FF",
        grey3: "#CCCCCC",
        black: "#000000",
      },
    },
  }),
  makeStyles: () => () => ({
    container: {},
    checkbox: {},
    checkboxChecked: {},
    label: {},
  }),
}))

jest.mock("react-native-vector-icons/Ionicons", () => "Icon")

describe("CheckboxRow", () => {
  const defaultProps = {
    label: "I agree to the terms and conditions",
    isChecked: false,
    onPress: jest.fn(),
  }

  beforeEach(jest.clearAllMocks)

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<CheckboxRow {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays label", () => {
      const { getByText } = render(<CheckboxRow {...defaultProps} />)

      expect(getByText("I agree to the terms and conditions")).toBeTruthy()
    })

    it("has accessibility role checkbox", () => {
      const { getByRole } = render(<CheckboxRow {...defaultProps} />)

      expect(getByRole("checkbox")).toBeTruthy()
    })

    it("has correct accessibility state when unchecked", () => {
      const { getByRole } = render(<CheckboxRow {...defaultProps} isChecked={false} />)

      const checkbox = getByRole("checkbox")
      expect(checkbox.props.accessibilityState).toEqual({ checked: false })
    })

    it("has correct accessibility state when checked", () => {
      const { getByRole } = render(<CheckboxRow {...defaultProps} isChecked={true} />)

      const checkbox = getByRole("checkbox")
      expect(checkbox.props.accessibilityState).toEqual({ checked: true })
    })
  })

  describe("interactions", () => {
    it("calls onPress when pressed", () => {
      const { getByRole } = render(<CheckboxRow {...defaultProps} />)

      fireEvent.press(getByRole("checkbox"))

      expect(defaultProps.onPress).toHaveBeenCalledTimes(1)
    })

    it("calls onPress on each press", () => {
      const { getByRole } = render(<CheckboxRow {...defaultProps} />)

      fireEvent.press(getByRole("checkbox"))
      fireEvent.press(getByRole("checkbox"))

      expect(defaultProps.onPress).toHaveBeenCalledTimes(2)
    })
  })

  describe("edge cases", () => {
    it("renders with long label text", () => {
      const longLabel =
        "This is a very long label text that should still render correctly even when it spans multiple lines in the component layout"

      const { getByText } = render(<CheckboxRow {...defaultProps} label={longLabel} />)

      expect(getByText(longLabel)).toBeTruthy()
    })
  })
})
