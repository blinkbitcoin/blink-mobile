import React, { createRef } from "react"
import { StyleSheet, TextInput } from "react-native"
import { render, screen } from "@testing-library/react-native"

import { SingleLinePlaceholderInput } from "@app/screens/send-bitcoin-screen/single-line-placeholder-input"

const PLACEHOLDER = "Felhasználónév, fizetési kérelem vagy cím"
const inputStyle = StyleSheet.create({ input: { fontSize: 18, marginLeft: 10 } }).input

describe("SingleLinePlaceholderInput", () => {
  it("draws the placeholder on one line, cut off at the end", () => {
    render(
      <SingleLinePlaceholderInput
        testID="input"
        placeholder={PLACEHOLDER}
        placeholderTextColor="#999999"
        style={inputStyle}
        value=""
      />,
    )

    const placeholder = screen.getByText(PLACEHOLDER)
    expect(placeholder.props.numberOfLines).toBe(1)
    expect(placeholder.props.ellipsizeMode).toBe("tail")
    expect(StyleSheet.flatten(placeholder.props.style)).toMatchObject({
      fontSize: 18,
      color: "#999999",
    })
    expect(screen.getByTestId("input").props.placeholder).toBeUndefined()
  })

  it("hides the placeholder once there is a value", () => {
    render(<SingleLinePlaceholderInput placeholder={PLACEHOLDER} value="alice" />)

    expect(screen.queryByText(PLACEHOLDER)).toBeNull()
  })

  it("forwards the ref to the TextInput", () => {
    const ref = createRef<TextInput>()
    render(<SingleLinePlaceholderInput ref={ref} placeholder={PLACEHOLDER} />)

    expect(ref.current).not.toBeNull()
    expect(typeof ref.current?.focus).toBe("function")
  })
})
