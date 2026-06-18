import React from "react"
import { Text as RNText, View } from "react-native"
import { render } from "@testing-library/react-native"

import { FeatureItem } from "@app/components/card-screen/feature-item"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        _black: "#000000",
        primary: "#3B82F6",
      },
    },
  }),
  makeStyles: () => () => ({
    featureContainer: {},
    iconStyle: {},
  }),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name }: { name: string; size: number; color: string }) => (
    <View testID={`galoy-icon-${name}`}>
      <RNText>{name}</RNText>
    </View>
  ),
  circleDiameterThatContainsSquare: (size: number) => size * Math.SQRT2,
}))

describe("FeatureItem", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(
        <FeatureItem feature={{ icon: "check-badge", title: "Free ATM withdrawals" }} />,
      )

      expect(toJSON()).toBeTruthy()
    })

    it("displays the feature title", () => {
      const { getByText } = render(
        <FeatureItem feature={{ icon: "check-badge", title: "Free ATM withdrawals" }} />,
      )

      expect(getByText("Free ATM withdrawals")).toBeTruthy()
    })
  })

  describe("icon variations", () => {
    it("renders with check-badge icon", () => {
      const { getByTestId } = render(
        <FeatureItem feature={{ icon: "check-badge", title: "Feature A" }} />,
      )

      expect(getByTestId("galoy-icon-check-badge")).toBeTruthy()
    })

    it("renders with btc-hand icon", () => {
      const { getByTestId } = render(
        <FeatureItem feature={{ icon: "btc-hand", title: "Feature B" }} />,
      )

      expect(getByTestId("galoy-icon-btc-hand")).toBeTruthy()
    })

    it("renders with heart-outline icon", () => {
      const { getByTestId } = render(
        <FeatureItem feature={{ icon: "heart-outline", title: "Feature C" }} />,
      )

      expect(getByTestId("galoy-icon-heart-outline")).toBeTruthy()
    })
  })

  describe("title variations", () => {
    it("renders with long title text", () => {
      const longTitle =
        "This is a very long feature title that should still render correctly without any layout issues in the component"

      const { getByText } = render(
        <FeatureItem feature={{ icon: "check-badge", title: longTitle }} />,
      )

      expect(getByText(longTitle)).toBeTruthy()
    })
  })
})
