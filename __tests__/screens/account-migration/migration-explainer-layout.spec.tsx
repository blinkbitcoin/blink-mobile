import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { Pressable, Text } from "react-native"

import { MigrationExplainerLayout } from "@app/screens/account-migration/migration-explainer-layout"
import { ContextForScreen } from "../helper"

jest.mock("@app/components/icon-hero", () => ({
  IconHero: ({ title }: { title: string }) => {
    const { Text: RNText } = jest.requireActual("react-native")
    return <RNText>{title}</RNText>
  },
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({ title, onPress }: { title: string; onPress: () => void }) => (
    <Pressable testID="cta-button" onPress={onPress}>
      <Text>{title}</Text>
    </Pressable>
  ),
}))

jest.mock("@app/components/screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe("MigrationExplainerLayout", () => {
  const mockOnCtaPress = jest.fn()

  const defaultProps = {
    icon: "key-outline" as const,
    iconColor: "#999",
    title: "Test Title",
    steps: [
      <Text key="1">Step one</Text>,
      <Text key="2">Step two</Text>,
      <Text key="3">Step three</Text>,
    ],
    ctaTitle: "Continue",
    onCtaPress: mockOnCtaPress,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders title", () => {
    const { getByText } = render(
      <ContextForScreen>
        <MigrationExplainerLayout {...defaultProps} />
      </ContextForScreen>,
    )
    expect(getByText("Test Title")).toBeTruthy()
  })

  it("renders all steps", () => {
    const { getByText } = render(
      <ContextForScreen>
        <MigrationExplainerLayout {...defaultProps} />
      </ContextForScreen>,
    )
    expect(getByText("Step one")).toBeTruthy()
    expect(getByText("Step two")).toBeTruthy()
    expect(getByText("Step three")).toBeTruthy()
  })

  it("renders step numbers", () => {
    const { getByText } = render(
      <ContextForScreen>
        <MigrationExplainerLayout {...defaultProps} />
      </ContextForScreen>,
    )
    expect(getByText("1.")).toBeTruthy()
    expect(getByText("2.")).toBeTruthy()
    expect(getByText("3.")).toBeTruthy()
  })

  it("renders CTA button with title", () => {
    const { getByText } = render(
      <ContextForScreen>
        <MigrationExplainerLayout {...defaultProps} />
      </ContextForScreen>,
    )
    expect(getByText("Continue")).toBeTruthy()
  })

  it("calls onCtaPress when button pressed", () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <MigrationExplainerLayout {...defaultProps} />
      </ContextForScreen>,
    )
    fireEvent.press(getByTestId("cta-button"))
    expect(mockOnCtaPress).toHaveBeenCalledTimes(1)
  })
})
