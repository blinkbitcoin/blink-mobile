import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardPersonalInformationScreen } from "@app/screens/card-screen/onboarding/card-flow/personal-information-screen"
import { ContextForScreen } from "../../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

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

jest.mock("@app/components/card-screen", () => {
  const { TouchableOpacity, Text } = jest.requireActual("react-native")
  return {
    DropdownComponent: ({
      testID,
      onValueChange,
    }: {
      testID: string
      onValueChange: (value: string) => void
      options: { value: string; label: string }[]
      selectedValue: string | undefined
      placeholder: string
    }) => (
      <TouchableOpacity testID={testID} onPress={() => onValueChange("selected-value")}>
        <Text>{testID}</Text>
      </TouchableOpacity>
    ),
    DropdownOption: {},
  }
})

describe("CardPersonalInformationScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <CardPersonalInformationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays occupation label", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardPersonalInformationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Occupation")).toBeTruthy()
  })

  it("displays annual salary label", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardPersonalInformationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Annual salary")).toBeTruthy()
  })

  it("displays account purpose label", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardPersonalInformationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Account purpose")).toBeTruthy()
  })

  it("displays expected monthly spending label", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardPersonalInformationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Expected monthly spending")).toBeTruthy()
  })

  it("button is disabled initially with no selections", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardPersonalInformationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText("Select")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("button text is select when not all fields are selected", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardPersonalInformationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Select")).toBeTruthy()
  })
})
