import React from "react"
import { ActivityIndicator, StyleSheet, Text, type TextStyle } from "react-native"
import { render, screen } from "@testing-library/react-native"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { ContextForScreen } from "../../screens/helper"

const renderButton = (props: { disabled?: boolean; loading?: boolean } = {}) =>
  render(
    <ContextForScreen>
      <GaloyPrimaryButton title="Continue" onPress={() => {}} {...props} />
    </ContextForScreen>,
  )

const getTitleColor = () =>
  (StyleSheet.flatten(screen.getByText("Continue").props.style) as TextStyle).color

const getSpinnerColor = () =>
  screen.UNSAFE_getByType(ActivityIndicator).props.color as string

describe("GaloyPrimaryButton", () => {
  it("draws the spinner in the same colour as the title", () => {
    // The title is replaced by the spinner while loading, so read it from the
    // idle render. Dark theme inverts `white`, and the library's literal
    // 'white' spinner would drift from the title it stands in for.
    renderButton()
    const titleColor = getTitleColor()
    screen.unmount()

    renderButton({ loading: true })

    expect(getSpinnerColor()).toBe(titleColor)
  })

  it("lets callers override the spinner colour", () => {
    render(
      <ContextForScreen>
        <GaloyPrimaryButton
          title="Continue"
          loading
          loadingProps={{ color: "#123456" }}
          onPress={() => {}}
        />
      </ContextForScreen>,
    )

    expect(getSpinnerColor()).toBe("#123456")
  })

  it("takes its testID from a string title, and skips it for a rendered one", () => {
    renderButton()
    expect(screen.getByTestId("Continue")).toBeTruthy()
    screen.unmount()

    // A node title has no string to name the button by, so the automatic
    // testProps are skipped rather than stringified into a useless id.
    render(
      <ContextForScreen>
        <GaloyPrimaryButton title={<Text>Continue</Text>} onPress={() => {}} />
      </ContextForScreen>,
    )

    expect(screen.getByText("Continue")).toBeTruthy()
    expect(screen.queryByTestId("Continue")).toBeNull()
  })
})
