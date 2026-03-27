import React from "react"
import { Keyboard } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

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

  it("listens to keyboard events", () => {
    const addListenerSpy = jest.spyOn(Keyboard, "addListener")

    render(
      <ContextForScreen>
        <SuggestionBar suggestions={["hello"]} onSelect={mockOnSelect} />
      </ContextForScreen>,
    )

    expect(addListenerSpy).toHaveBeenCalledWith("keyboardDidShow", expect.any(Function))
    expect(addListenerSpy).toHaveBeenCalledWith("keyboardDidHide", expect.any(Function))

    addListenerSpy.mockRestore()
  })
})
