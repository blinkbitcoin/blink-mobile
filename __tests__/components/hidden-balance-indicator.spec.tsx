import React from "react"
import { render } from "@testing-library/react-native"

import { HiddenBalanceIndicator } from "@app/components/hidden-balance-indicator/hidden-balance-indicator"

jest.mock("@rn-vui/themed", () => ({
  makeStyles: () => () => ({ container: {} }),
  useTheme: () => ({ theme: { colors: { grey4: "#CCCCCC" } } }),
}))

describe("HiddenBalanceIndicator", () => {
  describe('size="small"', () => {
    it("renders 4 circles", () => {
      const { UNSAFE_getAllByType } = render(<HiddenBalanceIndicator size="small" />)
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
      const { UNSAFE_getAllByType } = render(<HiddenBalanceIndicator size="small" />)
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
      const { UNSAFE_getAllByType } = render(<HiddenBalanceIndicator size="large" />)
      const { View } = jest.requireActual("react-native")
      const allViews = UNSAFE_getAllByType(View)
      const circles = allViews.filter(
        (v) => v.props.style && v.props.style.width !== undefined,
      )
      expect(circles).toHaveLength(4)
    })

    it("uses diameter 17 for large circles", () => {
      const { UNSAFE_getAllByType } = render(<HiddenBalanceIndicator size="large" />)
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
