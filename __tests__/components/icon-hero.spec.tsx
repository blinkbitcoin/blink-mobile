import React from "react"
import { StyleSheet, Text } from "react-native"
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

  it("lets a title wrap by default, because a heading is a sentence", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <IconHero icon="cloud-arrow-up" iconColor="green" title="Test Title" />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(getByText("Test Title").props.numberOfLines).toBeUndefined()
  })

  it("cuts a title short when the caller caps its lines", async () => {
    // A lightning address is one unbreakable thing: wrapping it mid-address reads as two
    // addresses, so a screen showing one asks for a single line instead.
    const { getByText } = render(
      <ContextForScreen>
        <IconHero
          icon="cloud-arrow-up"
          iconColor="green"
          title="deepbassoon958@walletofsatoshi.com"
          titleLines={1}
        />
      </ContextForScreen>,
    )
    await flushEffects()

    const title = getByText("deepbassoon958@walletofsatoshi.com")
    expect(title.props.numberOfLines).toBe(1)
    expect(title.props.ellipsizeMode).toBe("middle")
  })

  /** A long title used to clip at the icon's width: the text block stretches to the
   *  container and the title fills it, so the title wraps on the screen's margin. */
  it("gives the title the full width of the container", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <IconHero icon="btc-outline" iconColor="#000" title="Test Title" />
      </ContextForScreen>,
    )
    await flushEffects()
    const title = getByText("Test Title")

    expect(StyleSheet.flatten(title.props.style)).toMatchObject({
      width: "100%",
      textAlign: "center",
    })
    /** The themed Text wraps the host one, so the block holding the title is the first
     *  stretched ancestor within the hero itself, a few levels up at most. */
    const HERO_DEPTH = 4
    let block = title.parent
    for (let depth = 0; depth < HERO_DEPTH && block; depth += 1) {
      if (StyleSheet.flatten(block.props.style)?.alignSelf === "stretch") break
      block = block.parent
    }
    expect(StyleSheet.flatten(block?.props.style)).toMatchObject({ alignSelf: "stretch" })
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
