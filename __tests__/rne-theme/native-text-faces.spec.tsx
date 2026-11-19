import React from "react"
import { Platform, StyleSheet, TextStyle } from "react-native"

import { render } from "@testing-library/react-native"
import { Button, Input, ListItem, SearchBar, ThemeProvider } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { fonts } from "@app/rne-theme/fonts"
import theme from "@app/rne-theme/theme"

/**
 * These draw their text with React Native's own Text or TextInput, which knows nothing
 * of the themed Text. With no face they draw the platform font: Roboto on Android (the
 * RNE Button title even names `sans-serif-medium`), the system font on iOS. On Android a
 * weight of 700 or more on a Source Sans Pro face is Roboto Bold too, so bold text must
 * carry no such weight.
 */

const BOLD_WEIGHTS = ["bold", "700", "800", "900"]

const withTheme = (node: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{node}</ThemeProvider>)

const flatten = (style: unknown) => StyleSheet.flatten(style as TextStyle)

describe("native text faces", () => {
  const originalOS = Platform.OS

  beforeEach(() => {
    Platform.OS = "android"
  })

  afterEach(() => {
    Platform.OS = originalOS
  })

  it("draws the primary button label in the bold face", () => {
    const { getByText } = withTheme(<GaloyPrimaryButton title="Continue" />)
    const style = flatten(getByText("Continue").props.style)

    expect(style.fontFamily).toBe(fonts.bold)
    expect(BOLD_WEIGHTS).not.toContain(style.fontWeight)
  })

  it("draws the disabled primary button label in the bold face", () => {
    const { getByText } = withTheme(<GaloyPrimaryButton title="Continue" disabled />)
    const style = flatten(getByText("Continue").props.style)

    expect(style.fontFamily).toBe(fonts.bold)
    expect(BOLD_WEIGHTS).not.toContain(style.fontWeight)
  })

  it("draws the secondary button label in the bold face", () => {
    const { getByText } = withTheme(<GaloySecondaryButton title="Cancel" />)
    const style = flatten(getByText("Cancel").props.style)

    expect(style.fontFamily).toBe(fonts.bold)
    expect(BOLD_WEIGHTS).not.toContain(style.fontWeight)
  })

  it("draws a plain button label in the bold face", () => {
    const { getByText } = withTheme(<Button title="Try again" />)

    expect(flatten(getByText("Try again").props.style).fontFamily).toBe(fonts.bold)
  })

  it("keeps a face the caller names on a button label", () => {
    const { getByText } = withTheme(
      <Button title="Skip" titleStyle={{ fontFamily: fonts.regular }} />,
    )

    expect(flatten(getByText("Skip").props.style).fontFamily).toBe(fonts.regular)
  })

  it("draws input text in the regular face", () => {
    const { getByDisplayValue } = withTheme(<Input value="satoshi" />)

    expect(flatten(getByDisplayValue("satoshi").props.style).fontFamily).toBe(
      fonts.regular,
    )
  })

  it("draws search bar text in the regular face", () => {
    const { getByDisplayValue } = withTheme(
      <SearchBar platform="default" value="coffee" onChangeText={jest.fn()} />,
    )

    expect(flatten(getByDisplayValue("coffee").props.style).fontFamily).toBe(
      fonts.regular,
    )
  })

  it("draws list item titles and subtitles in the regular face", () => {
    const { getByText } = withTheme(
      <ListItem>
        <ListItem.Content>
          <ListItem.Title>Title</ListItem.Title>
          <ListItem.Subtitle>Subtitle</ListItem.Subtitle>
        </ListItem.Content>
      </ListItem>,
    )

    expect(flatten(getByText("Title").props.style).fontFamily).toBe(fonts.regular)
    expect(flatten(getByText("Subtitle").props.style).fontFamily).toBe(fonts.regular)
  })
})
