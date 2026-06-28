import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { Card } from "@app/components/card"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        warning: "#E18E02",
        grey5: "#EAEAEA",
        grey7: "#F9F9F9",
      },
    },
  }),
  makeStyles: () => () => ({
    card: {},
    static: {},
    active: {},
    warning: {},
    content: {},
    titleBox: {},
    titleText: {},
    row: {},
    body: {},
  }),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name }: { name: string; size: number; color: string }) => (
    <View testID={`galoy-icon-${name}`}>
      <RNText>{name}</RNText>
    </View>
  ),
}))

describe("Card", () => {
  describe("rendering", () => {
    it("renders the title", () => {
      const { getByText } = render(<Card title="Do not share this" />)

      expect(getByText("Do not share this")).toBeTruthy()
    })

    it("renders body children", () => {
      const { getByText } = render(<Card>Some helpful body text</Card>)

      expect(getByText("Some helpful body text")).toBeTruthy()
    })

    it("renders both title and body", () => {
      const { getByText } = render(<Card title="Heading">Body</Card>)

      expect(getByText("Heading")).toBeTruthy()
      expect(getByText("Body")).toBeTruthy()
    })
  })

  describe("warning variant", () => {
    it("shows the warning icon next to the title", () => {
      const { getByTestId } = render(<Card type="warning" title="Warning title" />)

      expect(getByTestId("galoy-icon-warning")).toBeTruthy()
    })

    it("shows the warning icon next to the body when there is no title", () => {
      const { getByTestId } = render(<Card type="warning">Body only</Card>)

      expect(getByTestId("galoy-icon-warning")).toBeTruthy()
    })
  })

  describe("default variant", () => {
    it("does not render a warning icon for a body-only default card", () => {
      const { queryByTestId } = render(<Card>Body only</Card>)

      expect(queryByTestId("galoy-icon-warning")).toBeNull()
    })
  })

  describe("press behavior", () => {
    it("calls onPress when pressed", () => {
      const onPress = jest.fn()
      const { getByText } = render(<Card onPress={onPress}>Tap me</Card>)

      fireEvent(getByText("Tap me"), "pressOut")

      expect(onPress).toHaveBeenCalledTimes(1)
    })

    it("does not crash when rendered without onPress", () => {
      const { toJSON } = render(<Card title="Static card" />)

      expect(toJSON()).toBeTruthy()
    })
  })
})
