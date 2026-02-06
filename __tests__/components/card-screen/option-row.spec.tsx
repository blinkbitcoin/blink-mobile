import React from "react"
import { Text as RNText, View } from "react-native"
import { render } from "@testing-library/react-native"

import { OptionRow } from "@app/components/card-screen/option-row"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        black: "#000000",
        primary: "#3B82F6",
        grey2: "#666666",
        grey4: "#E0E0E0",
        transparent: "transparent",
      },
    },
  }),
  makeStyles: () => () => ({
    container: {},
    textContainer: {},
    title: {},
    subtitle: {},
    value: {},
  }),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name, color }: { name: string; size: number; color: string }) => (
    <View testID={`galoy-icon-${name}`} accessibilityHint={color}>
      <RNText>{name}</RNText>
    </View>
  ),
}))

describe("OptionRow", () => {
  const defaultProps = {
    icon: "bank" as const,
    iconColor: "#FF0000",
    title: "Standard Delivery",
    subtitle: "5-7 business days",
    value: "$5.00",
  }

  beforeEach(jest.clearAllMocks)

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<OptionRow {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays the title", () => {
      const { getByText } = render(<OptionRow {...defaultProps} />)

      expect(getByText("Standard Delivery")).toBeTruthy()
    })

    it("displays the subtitle", () => {
      const { getByText } = render(<OptionRow {...defaultProps} />)

      expect(getByText("5-7 business days")).toBeTruthy()
    })

    it("displays the value", () => {
      const { getByText } = render(<OptionRow {...defaultProps} />)

      expect(getByText("$5.00")).toBeTruthy()
    })

    it("displays the icon", () => {
      const { getByTestId } = render(<OptionRow {...defaultProps} />)

      expect(getByTestId("galoy-icon-bank")).toBeTruthy()
    })
  })

  describe("props", () => {
    it("renders without value", () => {
      const { queryByText, getByText } = render(
        <OptionRow {...defaultProps} value={undefined} />,
      )

      expect(getByText("Standard Delivery")).toBeTruthy()
      expect(queryByText("$5.00")).toBeNull()
    })

    it("renders with highlighted", () => {
      const { toJSON } = render(<OptionRow {...defaultProps} highlighted={true} />)

      expect(toJSON()).toBeTruthy()
    })

    it("renders with children", () => {
      const { getByText } = render(
        <OptionRow {...defaultProps}>
          <RNText>Child Element</RNText>
        </OptionRow>,
      )

      expect(getByText("Child Element")).toBeTruthy()
    })

    it("applies custom valueColor", () => {
      const { getByText } = render(<OptionRow {...defaultProps} valueColor="#00FF00" />)

      const valueElement = getByText("$5.00")
      const flatStyle = Array.isArray(valueElement.props.style)
        ? Object.assign({}, ...valueElement.props.style)
        : valueElement.props.style

      expect(flatStyle.color).toBe("#00FF00")
    })
  })
})
