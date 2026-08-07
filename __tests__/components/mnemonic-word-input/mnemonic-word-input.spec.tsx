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

  /** The number slot is always mounted with a fixed width so the row cannot reflow on
   *  the first keystroke; empty inputs hide it with opacity only. */
  it("keeps the number invisible but mounted while the input is empty", () => {
    const { getByText } = renderInput({ value: "" })

    const number = getByText("1.")
    expect(StyleSheet.flatten(number.props.style).opacity).toBe(0)
  })

  it("shows the number once the input has content", () => {
    const { getByText } = renderInput({ value: "abandon", index: 4 })

    const number = getByText("5.")
    expect(StyleSheet.flatten(number.props.style).opacity).toBeUndefined()
  })

  it("treats whitespace-only content as empty for the number", () => {
    const { getByText } = renderInput({ value: "   " })

    expect(StyleSheet.flatten(getByText("1.").props.style).opacity).toBe(0)
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
      theme.lightColors?._green,
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
