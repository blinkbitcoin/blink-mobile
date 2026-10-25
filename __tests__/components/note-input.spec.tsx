import React from "react"
import { render, screen } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { NoteInput } from "@app/components/note-input"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import theme from "@app/rne-theme/theme"

loadLocale("en")

describe("NoteInput and the screen reader", () => {
  beforeEach(() => {
    render(
      <TypesafeI18n locale="en">
        <ThemeProvider theme={theme}>
          <NoteInput editable value="" onChangeText={jest.fn()} />
        </ThemeProvider>
      </TypesafeI18n>,
    )
  })

  /** Named for what it is, not its test ID, and reached directly, not inside a group. */
  it("reads the input as Add note", () => {
    const input = screen.getByTestId("add-note")

    expect(input.props.accessibilityLabel).toBe("Add note")
    expect(screen.queryByLabelText("add-note")).toBeNull()
  })

  it("leaves the field's wrapper and its pencil out, so the input is the one element", () => {
    const hosts = screen.UNSAFE_root.findAll((node) => typeof node.type === "string")
    // The field's Pressable would otherwise group the input under itself.
    expect(hosts.some((node) => node.props.accessible === false)).toBe(true)
    expect(
      hosts.some(
        (node) => node.props.importantForAccessibility === "no-hide-descendants",
      ),
    ).toBe(true)
  })
})
