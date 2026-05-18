import React from "react"
import { render } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { IconHero } from "@app/components/icon-hero"
import { ContextForScreen } from "../screens/helper"

loadLocale("en")

describe("IconHero", () => {
  it("renders the title", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <IconHero icon="nostr-wallet-connect" title="Test Title" />
      </ContextForScreen>,
    )

    expect(getByText("Test Title")).toBeTruthy()
  })

  it("renders subtitle when provided", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <IconHero icon="nostr-wallet-connect" title="Title" subtitle="Sub text" />
      </ContextForScreen>,
    )

    expect(getByText("Title")).toBeTruthy()
    expect(getByText("Sub text")).toBeTruthy()
  })

  it("does not render subtitle when not provided", async () => {
    const { getByText, queryByText } = render(
      <ContextForScreen>
        <IconHero icon="nostr-wallet-connect" title="Only Title" />
      </ContextForScreen>,
    )

    expect(getByText("Only Title")).toBeTruthy()
    expect(queryByText("Sub text")).toBeNull()
  })
})
