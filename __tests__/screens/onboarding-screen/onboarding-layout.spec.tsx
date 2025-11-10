import React from "react"
import { Text } from "react-native"
import { ThemeProvider } from "@rn-vui/themed"
import { fireEvent, render, screen } from "@testing-library/react-native"

import theme from "@app/rne-theme/theme"
import {
  OnboardingLayout,
  OnboardingLayoutProps,
} from "@app/screens/onboarding-screen/onboarding-layout"

import { ContextForScreen } from "../helper"

const mockOnPrimary = jest.fn()
const mockOnSecondary = jest.fn()

const baseProps: OnboardingLayoutProps = {
  title: "Example Title",
  descriptions: [
    "Example Description 1",
    "Example Description 2",
    "Example Description 3",
  ],
  iconName: "rank",
  primaryLabel: "Example Primary",
  secondaryLabel: "Example Secondary",
  onPrimaryAction: mockOnPrimary,
  onSecondaryAction: mockOnSecondary,
}

describe("OnboardingLayout", () => {
  const renderComponent = (props: Partial<OnboardingLayoutProps> = {}) => {
    return render(
      <ContextForScreen>
        <ThemeProvider theme={theme}>
          <OnboardingLayout {...baseProps} {...props} />
        </ThemeProvider>
      </ContextForScreen>,
    )
  }

  it("Shows title and all description lines", () => {
    renderComponent()
    expect(screen.getByText("Example Title")).toBeTruthy()
    expect(screen.getByText("Example Description 1")).toBeTruthy()
    expect(screen.getByText("Example Description 2")).toBeTruthy()
    expect(screen.getByText("Example Description 3")).toBeTruthy()
  })

  it("Triggers primary button action", () => {
    renderComponent()
    fireEvent.press(screen.getByText("Example Primary"))
    expect(mockOnPrimary).toHaveBeenCalled()
  })

  it("Triggers secondary button action", () => {
    renderComponent()
    fireEvent.press(screen.getByText("Example Secondary"))
    expect(mockOnSecondary).toHaveBeenCalled()
  })

  it("Renders optional custom content", () => {
    renderComponent({
      customContent: <Text testID="custom-text">Example Extra Info</Text>,
    })
    expect(screen.getByTestId("custom-text")).toBeTruthy()
    expect(screen.getByText("Example Extra Info")).toBeTruthy()
  })

  it("Does not show secondary button if label and handler are missing", () => {
    renderComponent({ secondaryLabel: undefined, onSecondaryAction: undefined })
    expect(screen.queryByText("Example Secondary")).toBeNull()
  })

  it("Renders icon when iconName is provided", () => {
    renderComponent()
    expect(screen.getByTestId("icon-rank")).toBeTruthy()
  })
})
