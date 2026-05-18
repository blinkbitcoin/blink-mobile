import React from "react"
import { Text } from "react-native"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { NwcEmptyStateScreen } from "@app/screens/nostr-wallet-connect/empty-state-screen"
import { ContextForScreen } from "../helper"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  }
})

jest.mock("@app/components/icon-hero", () => ({
  IconHero: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <>
      <Text>{title}</Text>
      {subtitle ? <Text>{subtitle}</Text> : null}
    </>
  ),
}))

describe("NwcEmptyStateScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("renders the headline", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <NwcEmptyStateScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(LL.NostrWalletConnect.emptyStateHeadline())).toBeTruthy()
  })

  it("renders the new connection button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <NwcEmptyStateScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(LL.NostrWalletConnect.newConnection())).toBeTruthy()
  })

  it("navigates to nwcNewConnection on button press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <NwcEmptyStateScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText(LL.NostrWalletConnect.newConnection())
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).toHaveBeenCalledWith("nwcNewConnection")
  })
})
