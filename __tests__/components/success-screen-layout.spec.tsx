import React from "react"
import { render } from "@testing-library/react-native"
import { Text, View } from "react-native"

import { SuccessScreenLayout } from "@app/components/success-screen-layout"
import { ContextForScreen } from "../screens/helper"

const mockOnComplete = jest.fn()

jest.mock("@app/components/success-animation/success-icon-animation", () => ({
  SuccessIconAnimation: ({ children }: { children: React.ReactNode }) => (
    <View testID="success-icon-animation">{children}</View>
  ),
}))

jest.mock("@app/components/success-animation/success-text-animation", () => ({
  CompletedTextAnimation: ({
    children,
    onComplete,
  }: {
    children: React.ReactNode
    onComplete?: () => void
  }) => {
    if (onComplete) onComplete()
    return <View testID="completed-text-animation">{children}</View>
  },
}))

describe("SuccessScreenLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders children inside text animation", () => {
    const { getByText, getByTestId } = render(
      <ContextForScreen>
        <SuccessScreenLayout>
          <Text>Success message</Text>
        </SuccessScreenLayout>
      </ContextForScreen>,
    )

    expect(getByTestId("completed-text-animation")).toBeTruthy()
    expect(getByText("Success message")).toBeTruthy()
  })

  it("renders icon inside icon animation", () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <SuccessScreenLayout>
          <Text>Done</Text>
        </SuccessScreenLayout>
      </ContextForScreen>,
    )

    expect(getByTestId("success-icon-animation")).toBeTruthy()
  })

  it("renders footer when provided", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SuccessScreenLayout footer={<Text>Go home</Text>}>
          <Text>Done</Text>
        </SuccessScreenLayout>
      </ContextForScreen>,
    )

    expect(getByText("Go home")).toBeTruthy()
  })

  it("does not render footer when not provided", () => {
    const { queryByText } = render(
      <ContextForScreen>
        <SuccessScreenLayout>
          <Text>Done</Text>
        </SuccessScreenLayout>
      </ContextForScreen>,
    )

    expect(queryByText("Go home")).toBeNull()
  })

  it("calls onAnimationComplete when animation finishes", () => {
    render(
      <ContextForScreen>
        <SuccessScreenLayout onAnimationComplete={mockOnComplete}>
          <Text>Done</Text>
        </SuccessScreenLayout>
      </ContextForScreen>,
    )

    expect(mockOnComplete).toHaveBeenCalledTimes(1)
  })

  it("does not call onAnimationComplete when not provided", () => {
    render(
      <ContextForScreen>
        <SuccessScreenLayout>
          <Text>Done</Text>
        </SuccessScreenLayout>
      </ContextForScreen>,
    )

    expect(mockOnComplete).not.toHaveBeenCalled()
  })
})
