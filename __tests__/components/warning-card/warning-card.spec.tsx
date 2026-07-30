import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { WarningCard } from "@app/components/warning-card"

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

describe("WarningCard", () => {
  describe("rendering", () => {
    it("renders the title", () => {
      const { getByText } = render(<WarningCard title="Do not share this" />)

      expect(getByText("Do not share this")).toBeTruthy()
    })

    it("renders body children", () => {
      const { getByText } = render(<WarningCard>Some helpful body text</WarningCard>)

      expect(getByText("Some helpful body text")).toBeTruthy()
    })

    it("renders both title and body", () => {
      const { getByText } = render(<WarningCard title="Heading">Body</WarningCard>)

      expect(getByText("Heading")).toBeTruthy()
      expect(getByText("Body")).toBeTruthy()
    })
  })

  describe("warning affordance", () => {
    it("shows the warning icon next to the title", () => {
      const { getByTestId } = render(<WarningCard title="Warning title" />)

      expect(getByTestId("galoy-icon-warning")).toBeTruthy()
    })

    it("shows the warning icon next to the body when there is no title", () => {
      const { getByTestId } = render(<WarningCard>Body only</WarningCard>)

      expect(getByTestId("galoy-icon-warning")).toBeTruthy()
    })

    it("shows a single warning icon when both title and body are present", () => {
      const { getAllByTestId } = render(<WarningCard title="Heading">Body</WarningCard>)

      expect(getAllByTestId("galoy-icon-warning")).toHaveLength(1)
    })
  })

  describe("press behavior", () => {
    it("calls onPress when pressed", () => {
      const onPress = jest.fn()
      const { getByText } = render(<WarningCard onPress={onPress}>Tap me</WarningCard>)

      fireEvent.press(getByText("Tap me"))

      expect(onPress).toHaveBeenCalledTimes(1)
    })

    it("does not crash when rendered without onPress", () => {
      const { toJSON } = render(<WarningCard title="Static card" />)

      expect(toJSON()).toBeTruthy()
    })
  })
})
