import React from "react"
import { render, fireEvent } from "@testing-library/react-native"

import { PasswordInput } from "@app/components/password-input"
import { ContextForScreen } from "../screens/helper"

describe("PasswordInput", () => {
  const defaultProps = {
    label: "Password",
    value: "",
    onChangeText: jest.fn(),
    placeholder: "Enter password",
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders label and placeholder", () => {
    const { getByText, getByPlaceholderText } = render(
      <ContextForScreen>
        <PasswordInput {...defaultProps} />
      </ContextForScreen>,
    )

    expect(getByText("Password")).toBeTruthy()
    expect(getByPlaceholderText("Enter password")).toBeTruthy()
  })

  it("calls onChangeText when typing", () => {
    const onChangeText = jest.fn()
    const { getByPlaceholderText } = render(
      <ContextForScreen>
        <PasswordInput {...defaultProps} onChangeText={onChangeText} />
      </ContextForScreen>,
    )

    fireEvent.changeText(getByPlaceholderText("Enter password"), "mypassword")
    expect(onChangeText).toHaveBeenCalledWith("mypassword")
  })

  it("renders error text when error prop is provided", () => {
    const { getByText } = render(
      <ContextForScreen>
        <PasswordInput {...defaultProps} error="Too short" />
      </ContextForScreen>,
    )

    expect(getByText("Too short")).toBeTruthy()
  })

  it("does not render error text when no error", () => {
    const { queryByText } = render(
      <ContextForScreen>
        <PasswordInput {...defaultProps} />
      </ContextForScreen>,
    )

    expect(queryByText("Too short")).toBeNull()
  })
})
