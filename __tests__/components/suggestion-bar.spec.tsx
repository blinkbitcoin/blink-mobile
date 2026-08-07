import React from "react"
import { StyleSheet } from "react-native"

import { render, fireEvent } from "@testing-library/react-native"
import type { ReactTestRendererJSON } from "react-test-renderer"

import { SuggestionBar } from "@app/components/suggestion-bar"
import { ContextForScreen } from "../screens/helper"

describe("SuggestionBar", () => {
  const mockOnSelect = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders nothing when suggestions are empty", () => {
    const { queryByRole } = render(
      <ContextForScreen>
        <SuggestionBar suggestions={[]} onSelect={mockOnSelect} />
      </ContextForScreen>,
    )

    expect(queryByRole("button")).toBeNull()
  })

  it("renders all suggestions as chips", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SuggestionBar
          suggestions={["hello", "help", "helmet"]}
          onSelect={mockOnSelect}
        />
      </ContextForScreen>,
    )

    expect(getByText("hello")).toBeTruthy()
    expect(getByText("help")).toBeTruthy()
    expect(getByText("helmet")).toBeTruthy()
  })

  it("calls onSelect with the selected word", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SuggestionBar suggestions={["hello", "help"]} onSelect={mockOnSelect} />
      </ContextForScreen>,
    )

    fireEvent.press(getByText("help"))
    expect(mockOnSelect).toHaveBeenCalledWith("help")
  })

  /** The bar's parents are keyboard-avoiding, so it must render in flow — an absolute
   *  bottom offset here stacked on the parent's own keyboard avoidance and floated the
   *  chips over the input rows (#4088 review follow-up). */
  it("renders in flow without absolute positioning or a keyboard offset", () => {
    const tree = render(
      <ContextForScreen>
        <SuggestionBar suggestions={["hello"]} onSelect={mockOnSelect} />
      </ContextForScreen>,
    ).toJSON() as ReactTestRendererJSON

    const style = StyleSheet.flatten(tree.props.style)
    expect(style.position).toBeUndefined()
    expect(style.bottom).toBeUndefined()
  })
})
