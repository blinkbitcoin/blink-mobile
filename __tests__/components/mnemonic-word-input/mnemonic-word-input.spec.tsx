import React, { createRef } from "react"
import { StyleSheet } from "react-native"
import type { ReactTestRendererJSON } from "react-test-renderer"

import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import {
  MnemonicWordInput,
  type MnemonicWordInputHandle,
} from "@app/components/mnemonic-word-input"

const defaultProps = {
  index: 0,
  value: "",
  placeholder: "Word 1",
  onChangeText: jest.fn(),
  onFocus: jest.fn(),
}

const renderInput = (props: Partial<React.ComponentProps<typeof MnemonicWordInput>>) =>
  render(
    <ThemeProvider theme={theme}>
      <MnemonicWordInput {...defaultProps} {...props} />
    </ThemeProvider>,
  )

describe("MnemonicWordInput", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  /** The design starts the placeholder at the field's padding, so an empty field
   *  keeps no room for the number. */
  it("leaves the number out while the input is empty", () => {
    const { queryByText } = renderInput({ value: "" })

    expect(queryByText("1.")).toBeNull()
  })

  it("shows the number once the input has content", () => {
    const { getByText } = renderInput({ value: "abandon", index: 4 })

    expect(getByText("5.")).toBeTruthy()
  })

  it("treats whitespace-only content as empty for the number", () => {
    const { queryByText } = renderInput({ value: "   " })

    expect(queryByText("1.")).toBeNull()
  })

  it("pads the field 14 on the left and 10 on the right, as the design does", () => {
    const root = renderInput({}).toJSON() as ReactTestRendererJSON
    const style = StyleSheet.flatten(root.props.style)

    expect(style.paddingLeft).toBe(14)
    expect(style.paddingRight).toBe(10)
  })

  it("forwards text changes and focus to the callbacks", () => {
    const onChangeText = jest.fn()
    const onFocus = jest.fn()
    const { getByTestId } = renderInput({ onChangeText, onFocus, testID: "my-input" })

    fireEvent.changeText(getByTestId("my-input"), "able")
    fireEvent(getByTestId("my-input"), "focus")

    expect(onChangeText).toHaveBeenCalledWith("able")
    expect(onFocus).toHaveBeenCalledTimes(1)
  })

  it("falls back to an index-derived testID", () => {
    const { getByTestId } = renderInput({ index: 3 })

    expect(getByTestId("word-input-3")).toBeTruthy()
  })

  it("marks the border for correct and wrong states", () => {
    const correct = renderInput({ correct: true }).toJSON() as ReactTestRendererJSON
    const wrong = renderInput({ wrong: true }).toJSON() as ReactTestRendererJSON

    expect(StyleSheet.flatten(correct.props.style).borderColor).toBe(
      theme.lightColors?.success,
    )
    expect(StyleSheet.flatten(wrong.props.style).borderColor).toBe(
      theme.lightColors?.error,
    )
  })

  it("focuses the native input through the imperative handle", () => {
    const ref = createRef<MnemonicWordInputHandle>()
    const { getByTestId } = renderInput({ testID: "focus-me" })
    render(
      <ThemeProvider theme={theme}>
        <MnemonicWordInput {...defaultProps} testID="focus-me-2" ref={ref} />
      </ThemeProvider>,
    )

    expect(getByTestId("focus-me")).toBeTruthy()
    expect(() => ref.current?.focus()).not.toThrow()
    expect(ref.current).not.toBeNull()
  })
})
