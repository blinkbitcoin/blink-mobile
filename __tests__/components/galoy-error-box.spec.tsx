import React from "react"
import { AccessibilityInfo } from "react-native"
import { act, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { WarningBanner } from "@app/components/warning-banner"
import theme from "@app/rne-theme/theme"

const wrap = (children: React.ReactNode) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
)

/** An error or warning appears without moving focus, so a screen reader must be told. */
describe("inline messages and the screen reader", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {})
    jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })
  ;[true, false].forEach((filled) => {
    it(`speaks an error as it appears (filled: ${filled})`, () => {
      render(wrap(<GaloyErrorBox errorMessage="Low funds" filled={filled} announce />))
      act(() => jest.runAllTimers())

      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith("Low funds")
    })
  })

  it("speaks a changed error once, and not again on a re-render", () => {
    const { rerender } = render(wrap(<GaloyErrorBox errorMessage="Low funds" announce />))
    act(() => jest.runAllTimers())
    rerender(wrap(<GaloyErrorBox errorMessage="Low funds" announce />))
    act(() => jest.runAllTimers())
    rerender(wrap(<GaloyErrorBox errorMessage="Amount too small" announce />))
    act(() => jest.runAllTimers())

    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(2)
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenLastCalledWith(
      "Amount too small",
    )
  })

  it("speaks a warning banner's text", () => {
    render(wrap(<WarningBanner announce>Lightning would be cheaper</WarningBanner>))
    act(() => jest.runAllTimers())

    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      "Lightning would be cheaper",
    )
  })

  it("stays quiet unless the screen asks it to speak", () => {
    render(wrap(<GaloyErrorBox errorMessage="Low funds" />))
    render(wrap(<WarningBanner>Lightning would be cheaper</WarningBanner>))
    act(() => jest.runAllTimers())

    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled()
  })

  /** The last message spoken lives in the box, so a box shown again is a new appearance. */
  it("speaks the same error again when the box is shown again", () => {
    const { unmount } = render(wrap(<GaloyErrorBox errorMessage="Low funds" announce />))
    act(() => jest.runAllTimers())
    unmount()
    render(wrap(<GaloyErrorBox errorMessage="Low funds" announce />))
    act(() => jest.runAllTimers())

    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(2)
  })
})
