import React from "react"
import { render, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { TopUpScreen } from "@app/screens/card-screen/onboarding/investment-flow/top-up-screen"
import { ContextForScreen } from "../../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

jest.mock("react-native-qrcode-svg", () => {
  const { View } = jest.requireActual("react-native")
  return {
    __esModule: true,
    default: (props: { value: string }) => <View testID={`qrcode-${props.value}`} />,
  }
})

jest.mock("react-native-vector-icons/Ionicons", () => {
  const { Text } = jest.requireActual("react-native")
  return {
    __esModule: true,
    default: (props: { name: string }) => <Text>{props.name}</Text>,
  }
})

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  }
})

describe("TopUpScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <TopUpScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays instruction text with min amount", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TopUpScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(/Top-up minimum of \$999/)).toBeTruthy()
  })

  it("displays Copy button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TopUpScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Copy")).toBeTruthy()
  })

  it("displays Share button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TopUpScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Share")).toBeTruthy()
  })

  it("displays BTC currency badge", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TopUpScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("BTC")).toBeTruthy()
  })
})
