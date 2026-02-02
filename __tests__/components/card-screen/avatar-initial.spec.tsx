import React from "react"
import { Text as RNText, View } from "react-native"
import { render } from "@testing-library/react-native"

import { AvatarInitial } from "@app/components/card-screen/avatar-initial"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        primary: "#F7931A",
        grey5: "#F5F5F5",
      },
    },
  }),
  makeStyles: () => () => ({
    container: {},
    text: {},
  }),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name, color }: { name: string; size: number; color: string }) => (
    <View testID={`galoy-icon-${name}`} accessibilityHint={color}>
      <RNText>{name}</RNText>
    </View>
  ),
}))

describe("AvatarInitial", () => {
  const defaultProps = {
    name: "Satoshi Nakamoto",
  }

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<AvatarInitial {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays the first letter of the name", () => {
      const { getByText } = render(<AvatarInitial {...defaultProps} />)

      expect(getByText("S")).toBeTruthy()
    })

    it("displays uppercase initial", () => {
      const { getByText } = render(<AvatarInitial name="john doe" />)

      expect(getByText("J")).toBeTruthy()
    })

    it("trims whitespace before extracting initial", () => {
      const { getByText } = render(<AvatarInitial name="  Alice Smith" />)

      expect(getByText("A")).toBeTruthy()
    })
  })

  describe("fallback icon", () => {
    it("renders user icon when name is empty", () => {
      const { getByTestId } = render(<AvatarInitial name="" />)

      expect(getByTestId("galoy-icon-user")).toBeTruthy()
    })

    it("renders user icon when name is only whitespace", () => {
      const { getByTestId } = render(<AvatarInitial name="   " />)

      expect(getByTestId("galoy-icon-user")).toBeTruthy()
    })

    it("does not render user icon when name is provided", () => {
      const { queryByTestId } = render(<AvatarInitial {...defaultProps} />)

      expect(queryByTestId("galoy-icon-user")).toBeNull()
    })
  })

  describe("different names", () => {
    it("renders initial for single letter name", () => {
      const { getByText } = render(<AvatarInitial name="X" />)

      expect(getByText("X")).toBeTruthy()
    })

    it("renders initial for single word name", () => {
      const { getByText } = render(<AvatarInitial name="Bitcoin" />)

      expect(getByText("B")).toBeTruthy()
    })

    it("renders initial for lowercase name", () => {
      const { getByText } = render(<AvatarInitial name="nakamoto" />)

      expect(getByText("N")).toBeTruthy()
    })

    it("renders initial for name with special characters", () => {
      const { getByText } = render(<AvatarInitial name="María García" />)

      expect(getByText("M")).toBeTruthy()
    })
  })

  describe("custom size", () => {
    it("renders with default size", () => {
      const { getByText } = render(<AvatarInitial {...defaultProps} />)

      expect(getByText("S")).toBeTruthy()
    })

    it("renders with custom size", () => {
      const { getByText } = render(<AvatarInitial {...defaultProps} size={100} />)

      expect(getByText("S")).toBeTruthy()
    })

    it("renders with small size", () => {
      const { getByText } = render(<AvatarInitial {...defaultProps} size={24} />)

      expect(getByText("S")).toBeTruthy()
    })
  })

  describe("accessibility", () => {
    it("has accessibility label with full name", () => {
      const { getByLabelText } = render(<AvatarInitial {...defaultProps} />)

      expect(getByLabelText("Initial S for Satoshi Nakamoto")).toBeTruthy()
    })

    it("has User icon accessibility label when name is empty", () => {
      const { getByLabelText } = render(<AvatarInitial name="" />)

      expect(getByLabelText("User icon")).toBeTruthy()
    })

    it("is accessible", () => {
      const { getByLabelText } = render(<AvatarInitial name="Alice" />)

      const container = getByLabelText("Initial A for Alice")
      expect(container.props.accessible).toBe(true)
    })
  })

  describe("rerender", () => {
    it("updates initial when name changes", () => {
      const { getByText, rerender } = render(<AvatarInitial name="Alice" />)

      expect(getByText("A")).toBeTruthy()

      rerender(<AvatarInitial name="Bob" />)

      expect(getByText("B")).toBeTruthy()
    })

    it("switches from initial to icon when name becomes empty", () => {
      const { getByText, queryByTestId, getByTestId, rerender } = render(
        <AvatarInitial name="Alice" />,
      )

      expect(getByText("A")).toBeTruthy()
      expect(queryByTestId("galoy-icon-user")).toBeNull()

      rerender(<AvatarInitial name="" />)

      expect(getByTestId("galoy-icon-user")).toBeTruthy()
    })

    it("switches from icon to initial when name is provided", () => {
      const { getByTestId, queryByTestId, getByText, rerender } = render(
        <AvatarInitial name="" />,
      )

      expect(getByTestId("galoy-icon-user")).toBeTruthy()

      rerender(<AvatarInitial name="Charlie" />)

      expect(getByText("C")).toBeTruthy()
      expect(queryByTestId("galoy-icon-user")).toBeNull()
    })
  })
})
