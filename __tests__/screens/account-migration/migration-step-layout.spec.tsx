import React from "react"
import { ScrollView, StyleSheet, Text } from "react-native"
import { fireEvent, render, screen } from "@testing-library/react-native"
import type { ReactTestInstance } from "react-test-renderer"

import { MigrationStepLayout } from "@app/screens/account-migration/migration-step-layout"
import { ContextForScreen } from "../helper"

const renderLayout = (
  props: Partial<React.ComponentProps<typeof MigrationStepLayout>> = {},
) =>
  render(
    <ContextForScreen>
      <MigrationStepLayout footer={<Text>footer action</Text>} {...props}>
        <Text>step content</Text>
      </MigrationStepLayout>
    </ContextForScreen>,
  )

const getScrollView = () => screen.UNSAFE_getByType(ScrollView)

/** Whether `node` is rendered anywhere beneath `ancestor`. */
const isInside = (node: ReactTestInstance, ancestor: ReactTestInstance): boolean => {
  for (let current = node.parent; current; current = current.parent) {
    if (current === ancestor) return true
  }
  return false
}

describe("MigrationStepLayout", () => {
  it("renders the step content inside a scroll view", () => {
    renderLayout()

    // The bug this guards: content laid out in a plain View overflows into the
    // footer once enlarged system text makes it taller than the viewport.
    expect(isInside(screen.getByText("step content"), getScrollView())).toBe(true)
  })

  it("renders the footer outside the scroll view", () => {
    renderLayout()

    // The footer must stay a sibling below the scroll area, never an overlay,
    // so the scroll viewport is always the height the buttons leave behind.
    expect(isInside(screen.getByText("footer action"), getScrollView())).toBe(false)
  })

  it("lets the content container grow so tall content can scroll", () => {
    renderLayout()

    expect(StyleSheet.flatten(getScrollView().props.contentContainerStyle)).toMatchObject(
      {
        flexGrow: 1,
      },
    )
  })

  it("applies contentStyle to the scroll content container", () => {
    // migration-required-screen passes { gap: 20 }, which is spacing between
    // children and so has to land on the content container, not the scroll view.
    renderLayout({ contentStyle: { gap: 20 } })

    expect(StyleSheet.flatten(getScrollView().props.contentContainerStyle)).toMatchObject(
      {
        gap: 20,
      },
    )
  })

  it("renders the header above the content", () => {
    renderLayout({ header: <Text>header row</Text> })

    expect(screen.getByText("header row")).toBeTruthy()
  })

  it("keeps contentStyle off the scroll view itself", () => {
    // Spacing passed as contentStyle belongs between the children; landing on
    // the scroll view it would pad the viewport instead and do nothing useful.
    renderLayout({ contentStyle: { gap: 20 } })

    expect(StyleSheet.flatten(getScrollView().props.style)).not.toMatchObject({ gap: 20 })
  })

  it("shows the scroll indicator", () => {
    renderLayout()

    // The scaffold has no visible clipping edge — content simply ends above the
    // footer — so the indicator is the only cue that more exists below. It only
    // appears when the content actually overflows, so it costs nothing at
    // normal text sizes.
    expect(getScrollView().props.showsVerticalScrollIndicator).not.toBe(false)
  })

  describe("when the content grows", () => {
    const scrollToEnd = ScrollView.prototype.scrollToEnd as jest.Mock

    /** Report a scroll position, in the shape RN's onScroll event delivers it. */
    const scrollTo = (offsetY: number, viewport: number, contentHeight: number) =>
      fireEvent.scroll(getScrollView(), {
        nativeEvent: {
          contentOffset: { x: 0, y: offsetY },
          layoutMeasurement: { width: 400, height: viewport },
          contentSize: { width: 400, height: contentHeight },
        },
      })

    const measure = (height: number) =>
      fireEvent(getScrollView(), "contentSizeChange", 400, height)

    beforeEach(() => {
      scrollToEnd.mockClear()
    })

    it("follows content that appears while the user is at the bottom", () => {
      // The explainer reveals its acknowledgement boxes one at a time. At large
      // text sizes the newly revealed box renders below the fold, and the user
      // is left with a disabled CTA and nothing visibly left to do.
      renderLayout()
      measure(600)

      measure(900)

      expect(scrollToEnd).toHaveBeenCalledWith({ animated: true })
    })

    it("stays put on the first measurement", () => {
      // Initial layout is not growth; following it would drop the user at the
      // bottom of a screen they have not read a word of yet.
      renderLayout()

      measure(2000)

      expect(scrollToEnd).not.toHaveBeenCalled()
    })

    it("stays put when the user has scrolled up", () => {
      renderLayout()
      measure(600)
      scrollTo(0, 300, 600)

      measure(900)

      expect(scrollToEnd).not.toHaveBeenCalled()
    })

    it("follows again once the user scrolls back to the bottom", () => {
      renderLayout()
      measure(600)
      scrollTo(0, 300, 600)
      scrollTo(300, 300, 600)

      measure(900)

      expect(scrollToEnd).toHaveBeenCalledWith({ animated: true })
    })

    it("stays put when the content shrinks", () => {
      renderLayout()
      measure(900)

      measure(600)

      expect(scrollToEnd).not.toHaveBeenCalled()
    })
  })
})
