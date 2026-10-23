import React from "react"
import { StyleSheet } from "react-native"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import {
  authenticatorAccountLabel,
  compactSetupKey,
  CopySecretComponent,
} from "@app/components/totp-export"
import TypesafeI18n from "@app/i18n/i18n-react"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import theme from "@app/rne-theme/theme"

loadLocale("en")
const LL = i18nObject("en")

const mockCopyToClipboard = jest.fn()
const mockUseClipboard = jest.fn()
jest.mock("@app/hooks", () => ({
  ...jest.requireActual("@app/hooks"),
  useClipboard: (clearAfterMs?: number) => {
    mockUseClipboard(clearAfterMs)
    return { copyToClipboard: mockCopyToClipboard }
  },
}))

const mockSetClipboard = jest.fn()
const mockGetClipboard = jest.fn()
jest.mock("@react-native-clipboard/clipboard", () => ({
  setString: (...args: unknown[]) => mockSetClipboard(...args),
  getString: () => mockGetClipboard(),
}))

const SECRET = "ABCD EFGH IJKL"

const renderField = (props: Partial<React.ComponentProps<typeof CopySecretComponent>>) =>
  render(
    <ThemeProvider theme={theme}>
      <TypesafeI18n locale="en">
        <CopySecretComponent secret={SECRET} {...props} />
      </TypesafeI18n>
    </ThemeProvider>,
  )

const fieldBorderColor = () =>
  StyleSheet.flatten(screen.getByTestId("setup-key-copy").props.style).borderColor

describe("compactSetupKey", () => {
  it("drops every space the key is shown or typed with", () => {
    expect(compactSetupKey(" ABCD EFGH\tIJKL ")).toBe("ABCDEFGHIJKL")
  })
})

describe("authenticatorAccountLabel", () => {
  it("names the account by its username", () => {
    expect(authenticatorAccountLabel({ id: "user-id", username: "someone" })).toBe(
      "someone",
    )
  })

  it("names an account without one by its user id", () => {
    expect(authenticatorAccountLabel({ id: "user-id", username: null })).toBe("user-id")
  })
})

describe("CopySecretComponent", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("shows the key as it was handed", () => {
    renderField({})

    expect(screen.getByText(SECRET)).toBeTruthy()
  })

  it("copies the key whole, without its spaces, and says so", () => {
    renderField({})

    fireEvent.press(screen.getByTestId("setup-key-copy"))

    expect(mockCopyToClipboard).toHaveBeenCalledWith({
      content: "ABCDEFGHIJKL",
      message: LL.CopySecretComponent.toastMessage(),
    })
  })

  /** A timed clear reads the clipboard back, which on iOS prompts for paste permission
   *  once the user has copied the code their authenticator made. */
  it("sets no timed clear on the copied key", () => {
    renderField({})

    expect(mockUseClipboard).toHaveBeenCalledWith(undefined)
  })

  /** Reading it back first would raise the paste prompt on iOS. */
  it("wipes the clipboard blind once it is gone, after a copy", () => {
    const { unmount } = renderField({})
    fireEvent.press(screen.getByTestId("setup-key-copy"))

    unmount()

    expect(mockSetClipboard).toHaveBeenCalledWith("")
    expect(mockGetClipboard).not.toHaveBeenCalled()
  })

  it("leaves the clipboard alone once it is gone, when nothing was copied", () => {
    const { unmount } = renderField({})

    unmount()

    expect(mockSetClipboard).not.toHaveBeenCalled()
  })

  it("tells the screen after each copy", () => {
    const onCopy = jest.fn()
    renderField({ onCopy })

    fireEvent.press(screen.getByTestId("setup-key-copy"))
    fireEvent.press(screen.getByTestId("setup-key-copy"))

    expect(onCopy).toHaveBeenCalledTimes(2)
  })

  it("outlines the field in the primary colour only where copying is the step to take", () => {
    const { unmount } = renderField({ isHighlighted: true })
    expect(fieldBorderColor()).toBe(theme.lightColors?.primary)
    unmount()

    renderField({})
    expect(fieldBorderColor()).toBe(theme.lightColors?.transparent)
  })
})
