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

  it("renders title when provided", () => {
    const { getByText } = render(
      <ContextForScreen>
        <InfoBanner title="Warning title">
          <Text>Content</Text>
        </InfoBanner>
      </ContextForScreen>,
    )
    expect(getByText("Warning title")).toBeTruthy()
  })

  it("renders icon when provided", () => {
    const { getByText } = render(
      <ContextForScreen>
        <InfoBanner icon="warning" title="With icon">
          <Text>Content</Text>
        </InfoBanner>
      </ContextForScreen>,
    )
    expect(getByText("With icon")).toBeTruthy()
  })

  it("renders without title and icon", () => {
    const { getByText, queryByText } = render(
      <ContextForScreen>
        <InfoBanner>
          <Text>Only content</Text>
        </InfoBanner>
      </ContextForScreen>,
    )
    expect(getByText("Only content")).toBeTruthy()
    expect(queryByText("Warning title")).toBeNull()
  })

  it("accepts custom iconColor and titleColor", () => {
    const { getByText } = render(
      <ContextForScreen>
        <InfoBanner
          title="Custom colors"
          icon="warning"
          iconColor="error"
          titleColor="error"
        >
          <Text>Content</Text>
        </InfoBanner>
      </ContextForScreen>,
    )
    expect(getByText("Custom colors")).toBeTruthy()
  })
})
