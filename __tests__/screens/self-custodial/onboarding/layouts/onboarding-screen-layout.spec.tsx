import React from "react"
import { Text, View } from "react-native"

import { render } from "@testing-library/react-native"

import { Screen } from "@app/components/screen"
import { OnboardingScreenLayout } from "@app/screens/self-custodial/onboarding/layouts"

jest.mock("@app/components/screen", () => ({
  Screen: jest.fn(({ children }: { children: React.ReactNode }) => (
    <View>{children}</View>
  )),
}))

const screenMock = Screen as unknown as jest.Mock

const renderLayout = (props: { headerless?: boolean } = {}) =>
  render(
    <OnboardingScreenLayout {...props}>
      <Text>body</Text>
    </OnboardingScreenLayout>,
  )

describe("OnboardingScreenLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
})
