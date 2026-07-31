import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { RouteProp } from "@react-navigation/native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { SectionCompleted } from "@app/screens/earns-screen/section-completed"

import { ContextForScreen, findPressableParent } from "./helper"

const mockPopTo = jest.fn()
jest.mock("@react-navigation/native", () => {
  const actual = jest.requireActual("@react-navigation/native")
  return {
    ...actual,
    useNavigation: () => ({
      ...actual.useNavigation?.(),
      popTo: mockPopTo,
    }),
  }
})

const buildRoute = (
  params: RootStackParamList["sectionCompleted"],
): RouteProp<RootStackParamList, "sectionCompleted"> => ({
  key: "sectionCompleted",
  name: "sectionCompleted",
  params,
})

describe("SectionCompleted", () => {
  const sectionTitle = "Bitcoin: What is it?"
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    LL = i18nObject("en")
  })

  const renderScreen = () =>
    render(
      <ContextForScreen>
        <SectionCompleted
          route={buildRoute({ amount: 0, sectionTitle, isAvailable: false })}
        />
      </ContextForScreen>,
    )

  it("shows the completed section title", () => {
    const { getByText } = renderScreen()

    expect(getByText(LL.EarnScreen.sectionsCompleted())).toBeTruthy()
    expect(getByText(sectionTitle)).toBeTruthy()
  })

  it("pops back to the existing Primary tabs from the keep-digging button", () => {
    const { getByText } = renderScreen()

    fireEvent.press(getByText(LL.EarnScreen.keepDigging()))

    expect(mockPopTo).toHaveBeenCalledWith("Primary")
  })

  it("pops back to the existing Primary tabs from the close cross", () => {
    const { getByTestId } = renderScreen()

    fireEvent.press(findPressableParent(getByTestId("icon-close")))

    expect(mockPopTo).toHaveBeenCalledWith("Primary")
  })
})
