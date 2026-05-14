import React from "react"
import { render, screen, fireEvent } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { SparkMigrationExplainerScreen } from "@app/screens/account-migration/to-non-custodial/explainer-screen"
import { ContextForScreen } from "../../helper"

loadLocale("en")

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}))

jest.mock("@app/utils/external", () => ({
  openExternalUrl: jest.fn(),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({
    sparkCompatibleWalletsUrl: "https://docs.spark.money/wallets/overview",
  }),
}))

jest.mock("@app/components/icon-hero", () => ({
  IconHero: ({ title }: { title: string }) => {
    const { Text } = jest.requireActual("react-native")
    return <Text>{title}</Text>
  },
}))

describe("SparkMigrationExplainerScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
  })

  it("renders the explainer title", () => {
    render(
      <ContextForScreen>
        <SparkMigrationExplainerScreen />
      </ContextForScreen>,
    )

    expect(screen.getByText("What does it mean to move to non-custodial?")).toBeTruthy()
  })

  it("renders all three steps", () => {
    render(
      <ContextForScreen>
        <SparkMigrationExplainerScreen />
      </ContextForScreen>,
    )

    expect(screen.getByText("1.")).toBeTruthy()
    expect(screen.getByText("2.")).toBeTruthy()
    expect(screen.getByText("3.")).toBeTruthy()
  })

  it("renders learn more link", () => {
    render(
      <ContextForScreen>
        <SparkMigrationExplainerScreen />
      </ContextForScreen>,
    )

    expect(screen.getByText("learn more here")).toBeTruthy()
  })

  it("opens external URL when learn more is pressed", () => {
    const { openExternalUrl } = jest.requireMock("@app/utils/external")

    render(
      <ContextForScreen>
        <SparkMigrationExplainerScreen />
      </ContextForScreen>,
    )

    fireEvent.press(screen.getByText("learn more here"))
    expect(openExternalUrl).toHaveBeenCalledWith(
      "https://docs.spark.money/wallets/overview",
    )
  })

  it("renders Let's move button", () => {
    render(
      <ContextForScreen>
        <SparkMigrationExplainerScreen />
      </ContextForScreen>,
    )

    expect(screen.getByText("Let's move")).toBeTruthy()
  })

  it("navigates to backup method on button press", () => {
    render(
      <ContextForScreen>
        <SparkMigrationExplainerScreen />
      </ContextForScreen>,
    )

    fireEvent.press(screen.getByText("Let's move"))
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupMethod")
  })
})
