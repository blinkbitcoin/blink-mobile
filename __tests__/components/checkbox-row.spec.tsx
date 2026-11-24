import React from "react"
import { StyleSheet, Text as RNText, View } from "react-native"
import { render, fireEvent, within } from "@testing-library/react-native"
import type { ReactTestRendererJSON } from "react-test-renderer"

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

  /** A screen reader reads whatever sits inside an accessible element as that element, so
   *  a link inside the checkbox could be neither reached nor opened on its own. */
  describe("rich label", () => {
    const onLinkPress = jest.fn()
    /** The row is the rendered tree's root: the box and the label are its children. */
    const rowOf = (tree: ReturnType<ReturnType<typeof render>["toJSON"]>) =>
      tree as ReactTestRendererJSON
    const renderRichRow = (props: { isChecked?: boolean; disabled?: boolean } = {}) =>
      render(
        <CheckboxRow
          isChecked={props.isChecked ?? false}
          disabled={props.disabled}
          onPress={defaultProps.onPress}
          gap={14}
          labelLineHeight={16}
          testID="fee-schedule-box"
        >
          I agree to the{" "}
          <RNText accessibilityRole="link" onPress={onLinkPress}>
            Fee Schedule
          </RNText>
          {null}
        </CheckboxRow>,
      )

    it("names the box after the words the label shows", () => {
      const { getByRole } = renderRichRow()

      expect(getByRole("checkbox", { name: "I agree to the Fee Schedule" })).toBeTruthy()
    })

    it("keeps a number the label shows in the box's name", () => {
      const { getByRole } = render(
        <CheckboxRow isChecked={false} onPress={defaultProps.onPress}>
          I accept the {2} documents
        </CheckboxRow>,
      )

      expect(getByRole("checkbox", { name: "I accept the 2 documents" })).toBeTruthy()
    })

    it("sets the label beside the box, with each link as an element of its own", () => {
      const { getByRole, getByText } = renderRichRow()

      const checkbox = getByRole("checkbox")
      expect(within(checkbox).queryByRole("link")).toBeNull()
      expect(within(checkbox).queryByText(/Fee Schedule/)).toBeNull()
      expect(getByRole("link", { name: "Fee Schedule" })).toBeTruthy()
      expect(getByText("I agree to the Fee Schedule")).toBeTruthy()
    })

    it("opens a link without toggling the box", () => {
      const { getByRole } = renderRichRow()

      fireEvent.press(getByRole("link", { name: "Fee Schedule" }))

      expect(onLinkPress).toHaveBeenCalledTimes(1)
      expect(defaultProps.onPress).not.toHaveBeenCalled()
    })

    it("toggles from the box, without opening a link", () => {
      const { getByTestId } = renderRichRow()

      fireEvent.press(getByTestId("fee-schedule-box"))

      expect(defaultProps.onPress).toHaveBeenCalledTimes(1)
      expect(onLinkPress).not.toHaveBeenCalled()
    })

    /** The box alone is a small target, so the prose beside it toggles too, as the
     *  whole row does on a plain label. */
    it("toggles from the label's prose, without opening a link", () => {
      const { getByText } = renderRichRow()

      const prose = getByText("I agree to the Fee Schedule")
      expect(prose.props.onPress).toEqual(expect.any(Function))
      fireEvent.press(prose)

      expect(defaultProps.onPress).toHaveBeenCalledTimes(1)
      expect(onLinkPress).not.toHaveBeenCalled()
    })

    it("reports whether the box is checked", () => {
      const { getByRole } = renderRichRow({ isChecked: true })

      expect(getByRole("checkbox", { checked: true })).toBeTruthy()
      expect(getByRole("checkbox").props.accessibilityState).toEqual({
        checked: true,
        disabled: undefined,
      })
    })

    it("keeps the row's spacing and the label's line height", () => {
      const { toJSON, getByText } = renderRichRow()

      expect(StyleSheet.flatten(rowOf(toJSON()).props.style)).toMatchObject({ gap: 14 })
      expect(
        StyleSheet.flatten(getByText("I agree to the Fee Schedule").props.style),
      ).toMatchObject({ lineHeight: 16 })
    })

    /** The prose loses its press outright: a press on it would otherwise reach the row's
     *  own handler in the test renderer, which climbs past the native responder. */
    it("fades the row and refuses the box and the prose when disabled", () => {
      const { getByRole, getByText, toJSON } = renderRichRow({ disabled: true })

      fireEvent.press(getByRole("checkbox", { disabled: true }))

      expect(defaultProps.onPress).not.toHaveBeenCalled()
      expect(getByText("I agree to the Fee Schedule").props.onPress).toBeUndefined()
      expect(StyleSheet.flatten(rowOf(toJSON()).props.style)).toMatchObject({
        opacity: 0.5,
      })
    })

    /** The documents can still be read while the row waits. */
    it("keeps the links open when disabled", () => {
      const { getByRole } = renderRichRow({ disabled: true })

      fireEvent.press(getByRole("link", { name: "Fee Schedule" }))

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
