import React from "react"
import { render } from "@testing-library/react-native"

import { IconHero } from "@app/components/icon-hero"
import { ContextForScreen } from "../screens/helper"

jest.mock("@app/components/atomic/galoy-icon", () => {
  const { Text } = jest.requireActual("react-native")
  return {
    GaloyIcon: ({ name }: { name: string }) => (
      <Text testID={`icon-${name}`}>{name}</Text>
    ),
  }
})

describe("IconHero", () => {
  it("renders title", () => {
    const { getByText } = render(
      <ContextForScreen>
        <IconHero icon="cloud-arrow-up" iconColor="green" title="Test Title" />
      </ContextForScreen>,
    )
    expect(getByText("Test Title")).toBeTruthy()
  })

  it("renders subtitle when provided", () => {
    const { getByText } = render(
      <ContextForScreen>
        <IconHero
          icon="cloud-arrow-up"
          iconColor="green"
          title="Title"
          subtitle="Test Subtitle"
        />
      </ContextForScreen>,
    )
    expect(getByText("Test Subtitle")).toBeTruthy()
  })

  it("does not render subtitle when not provided", () => {
    const { queryByText } = render(
      <ContextForScreen>
        <IconHero icon="cloud-arrow-up" iconColor="green" title="Title" />
      </ContextForScreen>,
    )
    expect(queryByText("Test Subtitle")).toBeNull()
  })

  it("renders the icon", () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <IconHero icon="cloud-arrow-up" iconColor="green" title="Title" />
      </ContextForScreen>,
    )
    expect(getByTestId("icon-cloud-arrow-up")).toBeTruthy()
  })
})
