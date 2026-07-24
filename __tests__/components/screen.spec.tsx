import React from "react"
import { Text } from "react-native"
import { render } from "@testing-library/react-native"

import { Screen } from "@app/components/screen"

jest.mock("@rn-vui/themed", () => ({
  useTheme: () => ({ theme: { mode: "light", colors: { white: "#FFFFFF" } } }),
}))

jest.mock("react-native-safe-area-context", () => {
  const ReactActual = jest.requireActual<typeof React>("react")
  return {
    SafeAreaView: ({ children, ...props }: React.PropsWithChildren<object>) =>
      ReactActual.createElement("SafeAreaView", { ...props, testID: "safe-area" }, children),
  }
})

const renderScreen = (props: React.ComponentProps<typeof Screen> = {}) =>
  render(
    <Screen {...props}>
      <Text>content</Text>
    </Screen>,
  )

describe("Screen safe-area edges", () => {
  it("defaults to all edges when the header is hidden", () => {
    const { getByTestId } = renderScreen({ headerShown: false })
    expect(getByTestId("safe-area").props.edges).toEqual([
      "top",
      "left",
      "right",
      "bottom",
    ])
  })

  it("defaults to side and bottom edges when a header is shown", () => {
    const { getByTestId } = renderScreen()
    expect(getByTestId("safe-area").props.edges).toEqual(["left", "right", "bottom"])
  })

  it("lets the edges prop override the derived edges", () => {
    const { getByTestId } = renderScreen({
      headerShown: false,
      edges: ["top", "left", "right"],
    })
    expect(getByTestId("safe-area").props.edges).toEqual(["top", "left", "right"])
  })

  it("applies the edges override on scrolling screens too", () => {
    const { getByTestId } = renderScreen({ preset: "scroll", edges: ["left", "right"] })
    expect(getByTestId("safe-area").props.edges).toEqual(["left", "right"])
  })

  it("renders no SafeAreaView when unsafe, even with edges set", () => {
    const { queryByTestId } = renderScreen({ unsafe: true, edges: ["bottom"] })
    expect(queryByTestId("safe-area")).toBeNull()
  })
})
