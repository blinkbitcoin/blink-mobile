import React from "react"
import { Text } from "react-native"
import { render } from "@testing-library/react-native"

import { IconHero } from "@app/components/icon-hero"
import { ContextForScreen } from "../screens/helper"
import { flushEffects } from "../helpers/flush-effects"

jest.mock("@app/components/atomic/galoy-icon", () => {
  const { Text } = jest.requireActual("react-native")
  return {
    GaloyIcon: ({ name }: { name: string }) => (
      <Text testID={`icon-${name}`}>{name}</Text>
    ),
  }
})

describe("IconHero", () => {
  it("renders title", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <IconHero icon="cloud-arrow-up" iconColor="green" title="Test Title" />
      </ContextForScreen>,
    )
    await flushEffects()
    expect(getByText("Test Title")).toBeTruthy()
  })

  it("renders subtitle when provided", async () => {
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
    await flushEffects()
    expect(getByText("Test Subtitle")).toBeTruthy()
  })

  it("renders a React node subtitle as-is", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <IconHero
          icon="cloud-arrow-up"
          iconColor="green"
          title="Title"
          subtitle={<Text>Node Subtitle</Text>}
        />
      </ContextForScreen>,
    )
    await flushEffects()
    expect(getByText("Node Subtitle")).toBeTruthy()
  })

  it("does not render subtitle when not provided", async () => {
    const { queryByText } = render(
      <ContextForScreen>
        <IconHero icon="cloud-arrow-up" iconColor="green" title="Title" />
      </ContextForScreen>,
    )
    await flushEffects()
    expect(queryByText("Test Subtitle")).toBeNull()
  })

  it("skips the subtitle text entirely for an empty string, adding no blank line", async () => {
    const countHostTexts = (node: unknown): number => {
      if (typeof node !== "object" || node === null) return 0
      const element = node as { type?: string; children?: unknown[] | null }
      const selfCount = element.type === "Text" ? 1 : 0
      const children = Array.isArray(element.children) ? element.children : []
      return children.reduce<number>(
        (sum, child) => sum + countHostTexts(child),
        selfCount,
      )
    }

    const emptyTree = render(
      <ContextForScreen>
        <IconHero icon="cloud-arrow-up" iconColor="green" title="Title" subtitle="" />
      </ContextForScreen>,
    ).toJSON()
    const noSubtitleTree = render(
      <ContextForScreen>
        <IconHero icon="cloud-arrow-up" iconColor="green" title="Title" />
      </ContextForScreen>,
    ).toJSON()
    await flushEffects()

    expect(countHostTexts(emptyTree)).toBe(countHostTexts(noSubtitleTree))
  })

  it("renders the icon", async () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <IconHero icon="cloud-arrow-up" iconColor="green" title="Title" />
      </ContextForScreen>,
    )
    await flushEffects()
    expect(getByTestId("icon-cloud-arrow-up")).toBeTruthy()
  })
})
