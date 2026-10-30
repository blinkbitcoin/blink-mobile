import React from "react"
import { KeyboardAvoidingView, Text } from "react-native"
import { render } from "@testing-library/react-native"

import { Screen } from "@app/components/screen"

const mockIsIos = { current: true }

jest.mock("@app/utils/helper", () => ({
  get isIos() {
    return mockIsIos.current
  },
}))

jest.mock("@rn-vui/themed", () => ({
  useTheme: () => ({ theme: { mode: "light", colors: { white: "#FFFFFF" } } }),
}))

jest.mock("react-native-safe-area-context", () => {
  const ReactActual = jest.requireActual<typeof React>("react")
  return {
    SafeAreaView: ({ children, ...props }: React.PropsWithChildren<object>) =>
      ReactActual.createElement(
        "SafeAreaView",
        { ...props, testID: "safe-area" },
        children,
      ),
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

describe("Screen keyboard avoidance", () => {
  const keyboardAvoidingProps = (props: React.ComponentProps<typeof Screen> = {}) =>
    renderScreen(props).UNSAFE_getByType(KeyboardAvoidingView).props

  beforeEach(() => {
    mockIsIos.current = true
  })

  it("lifts the content on iOS", () => {
    expect(keyboardAvoidingProps().behavior).toBe("padding")
  })

  it("leaves Android alone unless the screen asks", () => {
    mockIsIos.current = false
    expect(keyboardAvoidingProps().behavior).toBeUndefined()
  })

  /** Edge-to-edge no longer resizes Android's window for the keyboard. */
  it("lifts the content on Android when the screen asks", () => {
    mockIsIos.current = false
    expect(keyboardAvoidingProps({ avoidKeyboardOnAndroid: true }).behavior).toBe(
      "padding",
    )
  })

  it("takes an exact offset over the preset one", () => {
    expect(
      keyboardAvoidingProps({ keyboardOffset: "navigationHeader" })
        .keyboardVerticalOffset,
    ).toBe(100)
    expect(
      keyboardAvoidingProps({
        keyboardOffset: "navigationHeader",
        keyboardVerticalOffset: 64,
      }).keyboardVerticalOffset,
    ).toBe(64)
  })

  it("can turn the lift off, on scrolling screens too", () => {
    expect(keyboardAvoidingProps().enabled).toBe(true)
    expect(keyboardAvoidingProps({ avoidKeyboardEnabled: false }).enabled).toBe(false)
    expect(
      keyboardAvoidingProps({ preset: "scroll", avoidKeyboardEnabled: false }).enabled,
    ).toBe(false)
  })
})
