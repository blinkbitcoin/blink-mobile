import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { SelectableOptionRow } from "@app/components/card-screen/selectable-option-row"

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

describe("SelectableOptionRow", () => {
  const defaultProps = {
    icon: "bank" as const,
    iconColor: "#FF0000",
    title: "Standard Delivery",
    subtitle: "5-7 business days",
    value: "$5.00",
    isSelected: false,
    onPress: jest.fn(),
  }

  beforeEach(jest.clearAllMocks)

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<SelectableOptionRow {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays the title", () => {
      const { getByText } = render(<SelectableOptionRow {...defaultProps} />)

      expect(getByText("Standard Delivery")).toBeTruthy()
    })

    it("displays the subtitle", () => {
      const { getByText } = render(<SelectableOptionRow {...defaultProps} />)

      expect(getByText("5-7 business days")).toBeTruthy()
    })

    it("displays the value", () => {
      const { getByText } = render(<SelectableOptionRow {...defaultProps} />)

      expect(getByText("$5.00")).toBeTruthy()
    })

    it("displays the icon", () => {
      const { getByTestId } = render(<SelectableOptionRow {...defaultProps} />)

      expect(getByTestId("galoy-icon-bank")).toBeTruthy()
    })

    it("has accessibility role radio", () => {
      const { getByRole } = render(<SelectableOptionRow {...defaultProps} />)

      expect(getByRole("radio")).toBeTruthy()
    })
  })

  describe("props", () => {
    it("renders selected state", () => {
      const { getByRole } = render(
        <SelectableOptionRow {...defaultProps} isSelected={true} />,
      )

      const radio = getByRole("radio")
      expect(radio.props.accessibilityState).toEqual({ selected: true })
    })

    it("renders unselected state", () => {
      const { getByRole } = render(
        <SelectableOptionRow {...defaultProps} isSelected={false} />,
      )

      const radio = getByRole("radio")
      expect(radio.props.accessibilityState).toEqual({ selected: false })
    })

    it("renders without value", () => {
      const { queryByText, getByText } = render(
        <SelectableOptionRow {...defaultProps} value={undefined} />,
      )

      expect(getByText("Standard Delivery")).toBeTruthy()
      expect(queryByText("$5.00")).toBeNull()
    })

    it("applies custom valueColor", () => {
      const { getByText } = render(
        <SelectableOptionRow {...defaultProps} valueColor="#00FF00" />,
      )

      const valueElement = getByText("$5.00")
      const flatStyle = Array.isArray(valueElement.props.style)
        ? Object.assign({}, ...valueElement.props.style)
        : valueElement.props.style

      expect(flatStyle.color).toBe("#00FF00")
    })
  })

  describe("interactions", () => {
    it("calls onPress when pressed", () => {
      const onPress = jest.fn()
      const { getByRole } = render(
        <SelectableOptionRow {...defaultProps} onPress={onPress} />,
      )

      fireEvent.press(getByRole("radio"))

      expect(onPress).toHaveBeenCalledTimes(1)
    })
  })
})
