import React from "react"
import { View } from "react-native"
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

const getCircles = (result: ReturnType<typeof render>) =>
  result
    .UNSAFE_getAllByType(View)
    .filter((v) => v.props.style && v.props.style.width !== undefined)

describe("HiddenBalancePlaceholder", () => {
  describe('size="small"', () => {
    it("renders 4 circles", () => {
      expect(getCircles(render(<HiddenBalancePlaceholder size="small" />))).toHaveLength(
        4,
      )
    })

    it("uses diameter 12 for small circles", () => {
      getCircles(render(<HiddenBalancePlaceholder size="small" />)).forEach((circle) => {
        expect(circle.props.style.width).toBe(12)
        expect(circle.props.style.height).toBe(12)
      })
    })
  })

  describe('size="large"', () => {
    it("renders 4 circles", () => {
      expect(getCircles(render(<HiddenBalancePlaceholder size="large" />))).toHaveLength(
        4,
      )
    })

    it("uses diameter 17 for large circles", () => {
      getCircles(render(<HiddenBalancePlaceholder size="large" />)).forEach((circle) => {
        expect(circle.props.style.width).toBe(17)
        expect(circle.props.style.height).toBe(17)
      })
    })
  })
})
