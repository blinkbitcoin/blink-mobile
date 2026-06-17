import React from "react"
import { render, screen, fireEvent } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { MigrationExplainerScreen } from "@app/screens/account-migration/to-non-custodial/explainer-screen"
import { ContextForScreen } from "../../helper"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@app/components/icon-hero", () => ({
  IconHero: ({ title }: { title: string }) => {
    const { Text } = jest.requireActual("react-native")
    return <Text>{title}</Text>
  },
}))

const FEE_PERCENT = 0.5
jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ sparkDepositFeePercent: FEE_PERCENT }),
}))

const renderScreen = () =>
  render(
    <ContextForScreen>
      <MigrationExplainerScreen />
    </ContextForScreen>,
  )

describe("MigrationExplainerScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
  })

  it("renders the explainer title", () => {
    renderScreen()

    expect(screen.getByText(LL.AccountMigration.explainerTitle())).toBeTruthy()
  })

  it("reveals only the first checkbox initially and the rest as each is checked", () => {
    renderScreen()

    expect(screen.getAllByRole("checkbox")).toHaveLength(1)
    expect(screen.getByText(LL.AccountMigration.explainerCheck1())).toBeTruthy()

    fireEvent.press(screen.getByText(LL.AccountMigration.explainerCheck1()))
    expect(screen.getAllByRole("checkbox")).toHaveLength(2)

    fireEvent.press(screen.getByText(LL.AccountMigration.explainerCheck2()))
    expect(screen.getAllByRole("checkbox")).toHaveLength(3)

    fireEvent.press(screen.getByText(LL.AccountMigration.explainerCheck3()))
    expect(screen.getAllByRole("checkbox")).toHaveLength(4)
  })

  it("keeps Let's move inert until every checkbox is accepted, then navigates", () => {
    renderScreen()

    const cta = screen.getByText(LL.AccountMigration.letsMove())

    fireEvent.press(cta)
    expect(mockNavigate).not.toHaveBeenCalled()

    fireEvent.press(screen.getByText(LL.AccountMigration.explainerCheck1()))
    fireEvent.press(screen.getByText(LL.AccountMigration.explainerCheck2()))
    fireEvent.press(screen.getByText(LL.AccountMigration.explainerCheck3()))
    fireEvent.press(
      screen.getByText(LL.AccountMigration.explainerCheck4({ feePercent: FEE_PERCENT })),
    )

    fireEvent.press(cta)
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupMethod")
  })
})
