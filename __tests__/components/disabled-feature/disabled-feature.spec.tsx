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
  it("keeps children interactive and undimmed when not disabled", () => {
    const { getByText, toJSON } = render(
      <DisabledFeature disabled={false}>
        <Text>child-content</Text>
      </DisabledFeature>,
    )

    expect(getByText("child-content")).toBeTruthy()

    const tree = toJSON() as RenderedNode
    expect(tree.props.style).toBeFalsy()
    const innerView = tree.children?.[0] as RenderedNode
    expect(innerView.props.pointerEvents).toBe("box-none")
  })

  it("dims the content with opacity 0.5 when disabled", () => {
    const { toJSON, getByText } = render(
      <DisabledFeature disabled={true}>
        <Text>inner</Text>
      </DisabledFeature>,
    )

    /** Still rendered, just no longer exposed to screen readers. */
    expect(getByText("inner", { includeHiddenElements: true })).toBeTruthy()

    const tree = toJSON() as RenderedNode
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

  it("keeps the same tree shape across a disabled toggle, so children never remount", () => {
    const { toJSON, rerender } = render(
      <DisabledFeature disabled={false}>
        <Text>stable</Text>
      </DisabledFeature>,
    )
    const enabledTree = toJSON() as RenderedNode

    rerender(
      <DisabledFeature disabled={true}>
        <Text>stable</Text>
      </DisabledFeature>,
    )
    const disabledTree = toJSON() as RenderedNode

    expect(disabledTree.type).toBe(enabledTree.type)
    expect((disabledTree.children?.[0] as RenderedNode).type).toBe(
      (enabledTree.children?.[0] as RenderedNode).type,
    )
  })

  it("calls onDisabledPress when the wrapper is tapped", () => {
    const onDisabledPress = jest.fn()
    const { getByLabelText } = render(
      <DisabledFeature
        disabled={true}
        onDisabledPress={onDisabledPress}
        accessibilityLabel="tap-me"
      >
        <Text>child</Text>
      </DisabledFeature>,
    )

    /** The wrapper is what a screen reader reaches now, so it is what gets pressed. */
    fireEvent.press(getByLabelText("tap-me"))
    expect(onDisabledPress).toHaveBeenCalledTimes(1)
  })

  it("does not throw when tapped and onDisabledPress is omitted", () => {
    const { getByLabelText } = render(
      <DisabledFeature disabled={true} accessibilityLabel="tap-me">
        <Text>child</Text>
      </DisabledFeature>,
    )

    expect(() => fireEvent.press(getByLabelText("tap-me"))).not.toThrow()
  })

  /** A screen reader activates a child's onPress without touching pointerEvents. */
  describe("accessibility", () => {
    it("takes the children out of the accessibility tree when disabled", () => {
      const { toJSON } = render(
        <DisabledFeature disabled={true} accessibilityLabel="Stable Balance">
          <Text>inner</Text>
        </DisabledFeature>,
      )

      const innerView = (toJSON() as RenderedNode).children?.[0] as RenderedNode

      expect(innerView.props.accessibilityElementsHidden).toBe(true)
      expect(innerView.props.importantForAccessibility).toBe("no-hide-descendants")
    })

    it("leaves the children reachable when not disabled", () => {
      const { toJSON } = render(
        <DisabledFeature disabled={false} accessibilityLabel="Stable Balance">
          <Text>inner</Text>
        </DisabledFeature>,
      )

      const innerView = (toJSON() as RenderedNode).children?.[0] as RenderedNode

      expect(innerView.props.accessibilityElementsHidden).toBe(false)
      expect(innerView.props.importantForAccessibility).toBe("auto")
    })

    it("stands in for the hidden children as a single named button", () => {
      const { toJSON } = render(
        <DisabledFeature disabled={true} accessibilityLabel="Stable Balance">
          <Text>inner</Text>
        </DisabledFeature>,
      )

      const wrapper = toJSON() as RenderedNode

      expect(wrapper.props.accessible).toBe(true)
      expect(wrapper.props.accessibilityRole).toBe("button")
      expect(wrapper.props.accessibilityLabel).toBe("Stable Balance")
    })

    /** Announcing it disabled would tell the user not to bother activating it. */
    it("stays activatable rather than announcing itself as disabled", () => {
      const onDisabledPress = jest.fn()
      const { toJSON, getByLabelText } = render(
        <DisabledFeature
          disabled={true}
          onDisabledPress={onDisabledPress}
          accessibilityLabel="Stable Balance"
        >
          <Text>inner</Text>
        </DisabledFeature>,
      )

      expect((toJSON() as RenderedNode).props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: false }),
      )

      fireEvent.press(getByLabelText("Stable Balance"))
      expect(onDisabledPress).toHaveBeenCalledTimes(1)
    })

    it("claims neither the role nor the label while the feature is available", () => {
      const { toJSON } = render(
        <DisabledFeature disabled={false} accessibilityLabel="Stable Balance">
          <Text>inner</Text>
        </DisabledFeature>,
      )

      const wrapper = toJSON() as RenderedNode

      expect(wrapper.props.accessible).toBe(false)
      expect(wrapper.props.accessibilityRole).toBeUndefined()
      expect(wrapper.props.accessibilityLabel).toBeUndefined()
    })
  })
})
