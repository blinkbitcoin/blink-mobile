import React from "react"
import { render, fireEvent } from "@testing-library/react-native"

import { MnemonicWordInput } from "@app/components/mnemonic-word-input"

jest.mock("@rn-vui/themed", () => {
  const colors = {
    grey2: "#999",
    grey5: "#f5f5f5",
    primary: "#000",
    black: "#000",
    transparent: "transparent",
    _green: "#0f0",
    error: "#f00",
  }
  return {
    makeStyles:
      (fn: (theme: { colors: typeof colors }) => Record<string, object>) =>
      () =>
        fn({ colors }),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    useTheme: () => ({ theme: { colors } }),
  }
})

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

jest.mock("@app/utils/testProps", () => ({
  testProps: (id: string) => ({ testID: id }),
}))

describe("MnemonicWordInput", () => {
  const defaultProps = {
    index: 0,
    value: "",
    placeholder: "Word 1",
    onChangeText: jest.fn(),
    onFocus: jest.fn(),
  }

  it("renders placeholder when value is empty", () => {
    const { getByPlaceholderText } = render(<MnemonicWordInput {...defaultProps} />)

    expect(getByPlaceholderText("Word 1")).toBeTruthy()
  })

  it("shows word number when value is filled", () => {
    const { getByText } = render(
      <MnemonicWordInput {...defaultProps} index={2} value="alpha" />,
    )

    expect(getByText("3.")).toBeTruthy()
  })

  it("does not show word number when value is empty", () => {
    const { queryByText } = render(<MnemonicWordInput {...defaultProps} index={0} />)

    expect(queryByText("1.")).toBeNull()
  })

  it("calls onChangeText when text changes", () => {
    const onChangeText = jest.fn()
    const { getByPlaceholderText } = render(
      <MnemonicWordInput {...defaultProps} onChangeText={onChangeText} />,
    )

    fireEvent.changeText(getByPlaceholderText("Word 1"), "beta")

    expect(onChangeText).toHaveBeenCalledWith("beta")
  })

  it("calls onFocus when input is focused", () => {
    const onFocus = jest.fn()
    const { getByPlaceholderText } = render(
      <MnemonicWordInput {...defaultProps} onFocus={onFocus} />,
    )

    fireEvent(getByPlaceholderText("Word 1"), "focus")

    expect(onFocus).toHaveBeenCalled()
  })
})
