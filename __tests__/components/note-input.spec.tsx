import React from "react"
import { Keyboard, StyleSheet, TextInput } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
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
})

describe("NoteInput focus", () => {
  const keyboardListeners: Record<string, () => void> = {}

  beforeEach(() => {
    jest.spyOn(Keyboard, "addListener").mockImplementation((event, listener) => {
      keyboardListeners[event] = listener as () => void
      return { remove: jest.fn() } as unknown as ReturnType<typeof Keyboard.addListener>
    })
    render(
      <TypesafeI18n locale="en">
        <ThemeProvider theme={theme}>
          <NoteInput editable value="" onChangeText={jest.fn()} />
        </ThemeProvider>
      </TypesafeI18n>,
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  const fieldColor = () =>
    StyleSheet.flatten(screen.UNSAFE_getByProps({ accessible: false }).props.style)
      .backgroundColor
  const { grey5, grey6 } = theme.lightColors ?? {}

  it("lifts the field from grey5 to grey6 while it is typed in", () => {
    const input = screen.getByTestId("add-note")
    expect(fieldColor()).toBe(grey5)

    fireEvent(input, "focus")
    expect(fieldColor()).toBe(grey6)

    fireEvent(input, "blur")
    expect(fieldColor()).toBe(grey5)
  })

  /** Android's back gesture closes the keyboard but keeps the field focused. */
  it("lets go of focus when the keyboard closes", () => {
    const input = screen.UNSAFE_getByType(TextInput).instance
    input.blur.mockClear()

    act(() => keyboardListeners.keyboardDidHide())

    expect(input.blur).toHaveBeenCalledTimes(1)
  })
})
