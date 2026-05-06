import React from "react"
import { Text } from "react-native"
import { render, screen } from "@testing-library/react-native"

import { StatusScreenLayout } from "@app/components/status-screen-layout"
import { ContextForScreen } from "../screens/helper"

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name }: { name: string }) => {
    const { Text } = jest.requireActual("react-native")
    return <Text testID="galoy-icon">{name}</Text>
  },
}))

describe("StatusScreenLayout", () => {
  it("renders icon and children", () => {
    render(
      <ContextForScreen>
        <StatusScreenLayout icon="clock" iconBackgroundColor="#FFF9E5">
          <Text>Loading message</Text>
        </StatusScreenLayout>
      </ContextForScreen>,
    )

    expect(screen.getByText("Loading message")).toBeTruthy()
    expect(screen.getByTestId("galoy-icon")).toBeTruthy()
  })

  it("renders without icon background when not provided", () => {
    render(
      <ContextForScreen>
        <StatusScreenLayout icon="payment-success">
          <Text>Success</Text>
        </StatusScreenLayout>
      </ContextForScreen>,
    )

    expect(screen.getByText("Success")).toBeTruthy()
  })

  it("renders footer when provided", () => {
    render(
      <ContextForScreen>
        <StatusScreenLayout
          icon="clock"
          iconBackgroundColor="#FFF9E5"
          footer={<Text>Footer</Text>}
        >
          <Text>Content</Text>
        </StatusScreenLayout>
      </ContextForScreen>,
    )

    expect(screen.getByText("Footer")).toBeTruthy()
  })
})
