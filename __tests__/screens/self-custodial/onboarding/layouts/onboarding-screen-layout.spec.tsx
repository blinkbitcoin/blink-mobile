import React from "react"
import { Text, View } from "react-native"

import { HeaderHeightContext } from "@react-navigation/elements"
import { render } from "@testing-library/react-native"

import { Screen } from "@app/components/screen"
import { OnboardingScreenLayout } from "@app/screens/self-custodial/onboarding/layouts"

jest.mock("@app/components/screen", () => ({
  Screen: jest.fn(({ children }: { children: React.ReactNode }) => (
    <View>{children}</View>
  )),
}))

let mockKeyboardVisible = false
jest.mock("@app/hooks/use-keyboard-visible", () => ({
  useKeyboardVisible: () => mockKeyboardVisible,
}))

let mockIsIos = false
jest.mock("@app/utils/helper", () => ({
  ...jest.requireActual("@app/utils/helper"),
  get isIos() {
    return mockIsIos
  },
}))

const screenMock = Screen as unknown as jest.Mock
const screenProps = () => screenMock.mock.calls[screenMock.mock.calls.length - 1][0]

const renderWithKeyboard = (props: { headerless?: boolean } = {}) =>
  render(
    <HeaderHeightContext.Provider value={56}>
      <OnboardingScreenLayout avoidKeyboard {...props}>
        <Text>body</Text>
      </OnboardingScreenLayout>
    </HeaderHeightContext.Provider>,
  )

const renderLayout = (props: { headerless?: boolean } = {}) =>
  render(
    <OnboardingScreenLayout {...props}>
      <Text>body</Text>
    </OnboardingScreenLayout>,
  )

describe("OnboardingScreenLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockKeyboardVisible = false
    mockIsIos = false
  })

  it("hides the navigation header when headerless is set", () => {
    renderLayout({ headerless: true })

    expect(screenMock.mock.calls[0][0].headerShown).toBe(false)
  })

  it("leaves the header to the navigator when headerless is not set", () => {
    renderLayout()

    expect(screenMock.mock.calls[0][0].headerShown).toBeUndefined()
  })

  it("renders the footer below the body when one is passed", () => {
    const { getByText } = render(
      <OnboardingScreenLayout footer={<Text>footer</Text>}>
        <Text>body</Text>
      </OnboardingScreenLayout>,
    )

    expect(getByText("body")).toBeTruthy()
    expect(getByText("footer")).toBeTruthy()
  })

  describe("avoidKeyboard", () => {
    it("passes no keyboard props when not set", () => {
      renderLayout()

      expect(screenProps().avoidKeyboardOnAndroid).toBeUndefined()
      expect(screenProps().keyboardOffset).toBeUndefined()
    })

    it("lifts by the header height, on Android too", () => {
      renderWithKeyboard()

      expect(screenProps()).toMatchObject({
        keyboardOffset: "navigationHeader",
        keyboardVerticalOffset: 56,
        avoidKeyboardOnAndroid: true,
      })
    })

    /** A closed keyboard on Android would otherwise leave a stale lift. */
    it("turns the Android lift off and keeps the bottom inset while the keyboard is down", () => {
      renderWithKeyboard()

      expect(screenProps().avoidKeyboardEnabled).toBe(false)
      expect(screenProps().edges).toBeUndefined()
    })

    it("lifts and drops the bottom inset while the keyboard is up", () => {
      mockKeyboardVisible = true
      renderWithKeyboard()

      expect(screenProps().avoidKeyboardEnabled).toBe(true)
      expect(screenProps().edges).toEqual(["left", "right"])
    })

    it("keeps the top inset on a headerless screen while the keyboard is up", () => {
      mockKeyboardVisible = true
      renderWithKeyboard({ headerless: true })

      expect(screenProps().edges).toEqual(["top", "left", "right"])
    })

    it("keeps the lift on for iOS before the keyboard reports", () => {
      mockIsIos = true
      renderWithKeyboard()

      expect(screenProps().avoidKeyboardEnabled).toBe(true)
    })
  })
})
