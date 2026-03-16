import React from "react"
import { render } from "@testing-library/react-native"

import { HiddenBalancePlaceholder } from "@app/components/hidden-balance-placeholder/hidden-balance-placeholder"

jest.mock("@rn-vui/themed", () => ({
  makeStyles:
    (
      factory: (
        theme: { colors: Record<string, string> },
        props: { diameter: number; gap: number },
      ) => object,
    ) =>
    (props: { diameter: number; gap: number }) =>
      factory({ colors: { grey4: "#CCCCCC" } }, props),
}))

describe("HiddenBalancePlaceholder", () => {
  describe('size="small"', () => {
    it("renders 4 circles", () => {
      const { UNSAFE_getAllByType } = render(<HiddenBalancePlaceholder size="small" />)
      const { View } = jest.requireActual("react-native")
      // The component renders a container View plus 4 circle Views
      const allViews = UNSAFE_getAllByType(View)
      // 4 circles are inside the container; filter by having a width style
      const circles = allViews.filter(
        (v) => v.props.style && v.props.style.width !== undefined,
      )
      expect(circles).toHaveLength(4)
    })

    it("uses diameter 12 for small circles", () => {
      const { UNSAFE_getAllByType } = render(<HiddenBalancePlaceholder size="small" />)
      const { View } = jest.requireActual("react-native")
      const allViews = UNSAFE_getAllByType(View)
      const circles = allViews.filter(
        (v) => v.props.style && v.props.style.width !== undefined,
      )
      circles.forEach((circle) => {
        expect(circle.props.style.width).toBe(12)
        expect(circle.props.style.height).toBe(12)
      })
    })
  })

  describe('size="large"', () => {
    it("renders 4 circles", () => {
      const { UNSAFE_getAllByType } = render(<HiddenBalancePlaceholder size="large" />)
      const { View } = jest.requireActual("react-native")
      const allViews = UNSAFE_getAllByType(View)
      const circles = allViews.filter(
        (v) => v.props.style && v.props.style.width !== undefined,
      )
      expect(circles).toHaveLength(4)
    })

    it("uses diameter 17 for large circles", () => {
      const { UNSAFE_getAllByType } = render(<HiddenBalancePlaceholder size="large" />)
      const { View } = jest.requireActual("react-native")
      const allViews = UNSAFE_getAllByType(View)
      const circles = allViews.filter(
        (v) => v.props.style && v.props.style.width !== undefined,
      )
      circles.forEach((circle) => {
        expect(circle.props.style.width).toBe(17)
        expect(circle.props.style.height).toBe(17)
      })
    })
  })
})
