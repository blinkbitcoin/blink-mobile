import React from "react"
import { StyleSheet, Text as RNText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { CheckboxRow } from "@app/components/checkbox-row"

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name, ...props }: { name: string }) => (
    <View {...props} testID={`galoy-icon-${name}`} />
  ),
}))

/** backgroundDefault and textOnAccent share a value in the real palette, so they get
 *  distinct sentinels here to show which one the checkmark picks. */
jest.mock("@rn-vui/themed", () => {
  const colors = {
    backgroundDefault: "backgroundDefault",
    textOnAccent: "textOnAccent",
    accent: "#0066FF",
    textDisabled: "#CCCCCC",
    textOnBackground: "#000000",
  }
  return {
    Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
    useTheme: () => ({ theme: { colors } }),
    makeStyles:
      (factory: (theme: { colors: typeof colors }, props: object) => object) =>
      (props: object) =>
        factory({ colors }, props),
  }
})

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

  it("draws the checkmark in textOnAccent, the role for content on an accent fill", () => {
    const { getByTestId } = render(<CheckboxRow {...defaultProps} isChecked={true} />)

    expect(getByTestId("galoy-icon-check").props.color).toBe("textOnAccent")
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

  describe("centered prop", () => {
    it("applies centered styles when centered is true", () => {
      const { getByRole } = render(<CheckboxRow {...defaultProps} centered />)

      const checkbox = getByRole("checkbox")
      const containerStyles = checkbox.props.style
      expect(containerStyles).toEqual(
        expect.arrayContaining([expect.objectContaining({ alignSelf: "center" })]),
      )
    })

    it("does not apply centered styles by default", () => {
      const { getByRole } = render(<CheckboxRow {...defaultProps} />)

      const checkbox = getByRole("checkbox")
      const containerStyles = checkbox.props.style
      expect(containerStyles).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ alignSelf: "center" })]),
      )
    })
  })

  it("fades the row and ignores presses when disabled", () => {
    const { getByRole } = render(<CheckboxRow {...defaultProps} disabled />)

    fireEvent.press(getByRole("checkbox"))

    expect(StyleSheet.flatten(getByRole("checkbox").props.style)).toMatchObject({
      opacity: 0.5,
    })
    expect(defaultProps.onPress).not.toHaveBeenCalled()
  })

  describe("spacing", () => {
    it("keeps 10 between the box and the label and a 20 line by default", () => {
      const { getByRole, getByText } = render(<CheckboxRow {...defaultProps} />)

      expect(StyleSheet.flatten(getByRole("checkbox").props.style)).toMatchObject({
        gap: 10,
      })
      expect(StyleSheet.flatten(getByText(defaultProps.label).props.style)).toMatchObject(
        { lineHeight: 20 },
      )
    })

    it("takes the gap and the line height it is given", () => {
      const { getByRole, getByText } = render(
        <CheckboxRow {...defaultProps} gap={14} labelLineHeight={16} />,
      )

      expect(StyleSheet.flatten(getByRole("checkbox").props.style)).toMatchObject({
        gap: 14,
      })
      expect(StyleSheet.flatten(getByText(defaultProps.label).props.style)).toMatchObject(
        { lineHeight: 16 },
      )
    })
  })

  describe("rich label", () => {
    it("sets the inline parts in the label's text, and a part keeps its own press", () => {
      const onLinkPress = jest.fn()
      const { getByText } = render(
        <CheckboxRow isChecked={false} onPress={defaultProps.onPress}>
          I agree to the <RNText onPress={onLinkPress}>Fee Schedule</RNText>
        </CheckboxRow>,
      )

      expect(getByText("I agree to the Fee Schedule")).toBeTruthy()

      fireEvent.press(getByText("Fee Schedule"))

      expect(onLinkPress).toHaveBeenCalledTimes(1)
      expect(defaultProps.onPress).not.toHaveBeenCalled()
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
