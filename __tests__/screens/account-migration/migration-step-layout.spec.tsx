import React from "react"
import { ScrollView, StyleSheet, Text } from "react-native"
import { render, screen } from "@testing-library/react-native"
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
})
