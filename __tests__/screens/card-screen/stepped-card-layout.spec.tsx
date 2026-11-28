import React from "react"
import { Text } from "react-native"
import { render } from "@testing-library/react-native"

import { SteppedCardLayout } from "@app/screens/card-screen/stepped-card-layout"
import { ContextForScreen } from "../helper"

const renderLayout = (subtitle?: string) =>
  render(
    <ContextForScreen>
      <SteppedCardLayout
        steps={["Shipping", "Confirm"]}
        currentStep={1}
        icon="delivery"
        title="Order your physical card"
        subtitle={subtitle}
        buttonLabel="Continue"
        onButtonPress={jest.fn()}
      >
        <Text>content</Text>
      </SteppedCardLayout>
    </ContextForScreen>,
  )

describe("SteppedCardLayout", () => {
  it("shows the step's subtitle under its title", () => {
    const { getByText } = renderLayout("Review your order before submitting.")

    expect(getByText("Order your physical card")).toBeTruthy()
    expect(getByText("Review your order before submitting.")).toBeTruthy()
  })

  /** A step the design draws with its title alone leaves no empty line under it. */
  it("leaves no empty line under the title of a step without a subtitle", () => {
    const rendered = renderLayout()

    const emptyTexts = rendered
      .UNSAFE_getAllByType(Text)
      .filter((text) => text.props.children === undefined || text.props.children === "")

    expect(emptyTexts).toHaveLength(0)
  })
})
