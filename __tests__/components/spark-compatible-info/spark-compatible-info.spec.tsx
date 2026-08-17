import React from "react"
import { render, fireEvent } from "@testing-library/react-native"

import { SparkCompatibleInfo } from "@app/components/spark-compatible-info"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { ContextForScreen } from "../../screens/helper"

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({
    sparkCompatibleWalletsUrl: "https://spark.example",
  }),
}))

const mockOpenExternalUrl = jest.fn()
jest.mock("@app/utils/external", () => ({
  ...jest.requireActual("@app/utils/external"),
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))

loadLocale("en")
const LL = i18nObject("en")

describe("SparkCompatibleInfo", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders the spark-compatible copy with the link", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkCompatibleInfo />
      </ContextForScreen>,
    )

    expect(
      getByText(LL.BackupScreen.ManualBackup.Phrase.sparkCompatibleLink()),
    ).toBeTruthy()
  })

  it("opens the wallet list URL from remote config when the link is pressed", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkCompatibleInfo />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Phrase.sparkCompatibleLink()))

    expect(mockOpenExternalUrl).toHaveBeenCalledWith("https://spark.example")
  })

  it("exposes the link with the link accessibility role", () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <SparkCompatibleInfo />
      </ContextForScreen>,
    )

    expect(getByTestId("spark-compatible-link").props.accessibilityRole).toBe("link")
  })
})
