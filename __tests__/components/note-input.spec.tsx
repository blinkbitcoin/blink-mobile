import React from "react"
import { render, screen } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { NoteInput } from "@app/components/note-input"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import theme from "@app/rne-theme/theme"

loadLocale("en")

describe("NoteInput with its own placeholder", () => {
  /** A field that is not a note (the transaction's custom label) must not read as one. */
  it("shows and reads the placeholder instead of Add note", () => {
    render(
      <TypesafeI18n locale="en">
        <ThemeProvider theme={theme}>
          <NoteInput editable value="" placeholder="Custom label" maxLength={140} />
        </ThemeProvider>
      </TypesafeI18n>,
    )
    const input = screen.getByTestId("add-note")

    expect(input.props.placeholder).toBe("Custom label")
    expect(input.props.accessibilityLabel).toBe("Custom label")
    expect(input.props.maxLength).toBe(140)
  })

  it("keeps Add note and the 500 cap when the caller sets neither", () => {
    render(
      <TypesafeI18n locale="en">
        <ThemeProvider theme={theme}>
          <NoteInput editable value="" />
        </ThemeProvider>
      </TypesafeI18n>,
    )
    const input = screen.getByTestId("add-note")

    expect(input.props.placeholder).toBe("Add note")
    expect(input.props.maxLength).toBe(500)
  })
})
