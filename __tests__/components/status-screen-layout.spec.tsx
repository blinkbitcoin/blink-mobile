import React from "react"
import { Text } from "react-native"
import { render, screen } from "@testing-library/react-native"

import { StatusScreenLayout } from "@app/components/status-screen-layout"
import { ContextForScreen } from "../screens/helper"
import { flushEffects } from "../helpers/flush-effects"

const mockGaloyIcon = jest.fn()
jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: (props: { name: string; color?: string }) => {
    mockGaloyIcon(props)
    const { Text } = jest.requireActual("react-native")
    return <Text testID="galoy-icon">{props.name}</Text>
  },
}))

beforeEach(() => {
  mockGaloyIcon.mockClear()
})

describe("StatusScreenLayout", () => {
  it("renders icon and children", async () => {
    render(
      <ContextForScreen>
        <StatusScreenLayout icon="clock" iconBackgroundColor="#FFF9E5">
          <Text>Loading message</Text>
        </StatusScreenLayout>
      </ContextForScreen>,
    )
    await flushEffects()

    expect(screen.getByText("Loading message")).toBeTruthy()
    expect(screen.getByTestId("galoy-icon")).toBeTruthy()
  })

  it("renders without icon background when not provided", async () => {
    render(
      <ContextForScreen>
        <StatusScreenLayout icon="payment-success">
          <Text>Success</Text>
        </StatusScreenLayout>
      </ContextForScreen>,
    )
    await flushEffects()

    expect(screen.getByText("Success")).toBeTruthy()
  })

  it("renders footer when provided", async () => {
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
    await flushEffects()

    expect(screen.getByText("Footer")).toBeTruthy()
  })

  it("forwards iconColor to the icon", async () => {
    render(
      <ContextForScreen>
        <StatusScreenLayout icon="clock" iconColor="#F59E0B">
          <Text>Content</Text>
        </StatusScreenLayout>
      </ContextForScreen>,
    )
    await flushEffects()

    expect(mockGaloyIcon).toHaveBeenCalledWith(
      expect.objectContaining({ color: "#F59E0B" }),
    )
  })
})
