import React from "react"
import { Text } from "react-native"
import { fireEvent, render } from "@testing-library/react-native"

import { DisabledFeature } from "@app/components/disabled-feature/disabled-feature"

type RenderedNode = {
  type: string
  props: Record<string, unknown>
  children?: (RenderedNode | string)[]
}

describe("DisabledFeature", () => {
  it("renders children unchanged when not disabled", () => {
    const { getByText, toJSON } = render(
      <DisabledFeature disabled={false}>
        <Text>child-content</Text>
      </DisabledFeature>,
    )

    expect(getByText("child-content")).toBeTruthy()

    const tree = toJSON() as RenderedNode | null
    // No outer accessible/focusable wrapper: the children render at the top.
    expect(tree?.props.accessible).toBeFalsy()
    expect(tree?.props.focusable).toBeFalsy()
    expect(tree?.props.style).toBeUndefined()
  })

  it("wraps children in an accessible View with opacity 0.5 when disabled", () => {
    const { toJSON, getByText } = render(
      <DisabledFeature disabled={true}>
        <Text>inner</Text>
      </DisabledFeature>,
    )

    expect(getByText("inner")).toBeTruthy()

    const tree = toJSON() as RenderedNode
    expect(tree.props.accessible).toBe(true)
    expect(tree.props.focusable).toBe(true)
    expect(tree.props.style).toEqual(expect.objectContaining({ opacity: 0.5 }))
  })

  it("blocks pointer events on the inner content when disabled", () => {
    const { toJSON } = render(
      <DisabledFeature disabled={true}>
        <Text>inner</Text>
      </DisabledFeature>,
    )

    const tree = toJSON() as RenderedNode
    const innerView = tree.children?.[0] as RenderedNode
    expect(innerView.props.pointerEvents).toBe("none")
  })

  it("calls onDisabledPress when the wrapper is tapped", () => {
    const onDisabledPress = jest.fn()
    const { getByText } = render(
      <DisabledFeature disabled={true} onDisabledPress={onDisabledPress}>
        <Text>tap-me</Text>
      </DisabledFeature>,
    )

    fireEvent.press(getByText("tap-me"))
    expect(onDisabledPress).toHaveBeenCalledTimes(1)
  })

  it("does not throw when tapped and onDisabledPress is omitted", () => {
    const { getByText } = render(
      <DisabledFeature disabled={true}>
        <Text>tap-me</Text>
      </DisabledFeature>,
    )

    expect(() => fireEvent.press(getByText("tap-me"))).not.toThrow()
  })
})
