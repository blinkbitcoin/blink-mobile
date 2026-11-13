import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { Input } from "@rn-vui/themed"

import { CodeInput } from "@app/components/code-input"

import { expectFocusFill, flatStyle } from "../../helpers/field-fill"
import { flushEffects } from "../../helpers/flush-effects"
import { ContextForScreen } from "../../screens/helper"

const mockSend = jest.fn()
const mockSetErrorMessage = jest.fn()

const renderInput = async (loading: boolean, errorMessage = "") => {
  render(
    <ContextForScreen>
      <CodeInput
        send={mockSend}
        header="Enter the code"
        loading={loading}
        errorMessage={errorMessage}
        setErrorMessage={mockSetErrorMessage}
      />
    </ContextForScreen>,
  )
  await flushEffects()
}

const field = () => screen.getByTestId("code-input")

/** rn-vui types `Input`'s ref as the bare TextInput underneath it, which does not fit a
 *  component type. Only the container style is read here. */
const ThemedInput = Input as unknown as React.ComponentType<{
  inputContainerStyle: unknown
}>

describe("CodeInput", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("sends the code once it has six digits", async () => {
    await renderInput(false)

    fireEvent.changeText(field(), "12345")
    expect(mockSend).not.toHaveBeenCalled()
    fireEvent.changeText(field(), "123456")

    expect(mockSend).toHaveBeenCalledWith("123456")
    expect(field().props.value).toBe("123456")
  })

  it("takes nothing past six digits", async () => {
    await renderInput(false)

    fireEvent.changeText(field(), "1234567")

    expect(mockSend).not.toHaveBeenCalled()
    expect(field().props.value).toBe("")
  })

  /** Another code would show in the field, though the one checked is the first. */
  it("takes nothing typed while a code is checked", async () => {
    await renderInput(true)

    fireEvent.changeText(field(), "654321")

    expect(mockSend).not.toHaveBeenCalled()
    expect(mockSetErrorMessage).not.toHaveBeenCalled()
    expect(field().props.value).toBe("")
  })

  it("shows the error it is given, and clears it once typing again", async () => {
    await renderInput(false, "That code is wrong")
    expect(screen.getByText("That code is wrong")).toBeTruthy()

    fireEvent.changeText(field(), "1")

    expect(mockSetErrorMessage).toHaveBeenCalledWith("")
  })

  it("fills the field, darker while it has focus, and starts focused", async () => {
    await renderInput(false)

    expectFocusFill({
      startsFocused: true,
      surfaces: () => [
        flatStyle(screen.UNSAFE_getByType(ThemedInput).props.inputContainerStyle),
      ],
      focus: () => fireEvent(field(), "focus"),
      blur: () => fireEvent(field(), "blur"),
    })
  })
})
