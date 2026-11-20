import React from "react"
import { StyleSheet } from "react-native"
import { render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import GaloySliderButton from "@app/components/atomic/galoy-slider-button/galoy-slider-button"
import theme from "@app/rne-theme/theme"

const renderSlider = (isLoading: boolean) =>
  render(
    <ThemeProvider theme={theme}>
      <GaloySliderButton
        onSwipe={jest.fn()}
        initialText="Slide to send"
        loadingText="Sending"
        isLoading={isLoading}
      />
    </ThemeProvider>,
  )

const textStyle = (screen: ReturnType<typeof render>, text: string) =>
  StyleSheet.flatten(screen.getByText(text).props.style)

/* The knob rests on the left of the track, so only the idle label pads clear of it. Once
 * loading, the knob is gone and the loading label centres across the whole track. */
describe("GaloySliderButton label clearance", () => {
  it("keeps the idle label clear of the knob", () => {
    const style = textStyle(renderSlider(false), "Slide to send")

    expect(style).toMatchObject({ paddingLeft: 70, paddingRight: 12 })
  })

  it("leaves the loading label unpadded once the knob is gone", () => {
    const style = textStyle(renderSlider(true), "Sending")

    expect(style.paddingLeft).toBeUndefined()
    expect(style.paddingRight).toBeUndefined()
  })
})
