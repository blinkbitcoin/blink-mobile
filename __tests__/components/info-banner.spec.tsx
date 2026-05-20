import React from "react"
import { Text } from "react-native"
import { render } from "@testing-library/react-native"

import { InfoBanner } from "@app/components/info-banner"
import { ContextForScreen } from "../screens/helper"

describe("InfoBanner", () => {
  it("renders children text", () => {
    const { getByText } = render(
      <ContextForScreen>
        <InfoBanner>
          <Text>Banner content</Text>
        </InfoBanner>
      </ContextForScreen>,
    )
    expect(getByText("Banner content")).toBeTruthy()
  })

  it("renders multiple children", () => {
    const { getByText } = render(
      <ContextForScreen>
        <InfoBanner>
          <Text>First part</Text>
          <Text>Second part</Text>
        </InfoBanner>
      </ContextForScreen>,
    )
    expect(getByText("First part")).toBeTruthy()
    expect(getByText("Second part")).toBeTruthy()
  })
})
