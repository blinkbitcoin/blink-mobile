import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { MigrationExplainerScreen } from "@app/screens/account-migration/to-non-custodial/explainer-screen"
import { ContextForScreen } from "../../helper"
import { flushEffects } from "../../../helpers/flush-effects"

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

const mockEnsureAccount = jest.fn()
let mockIsProvisioning = false
jest.mock("@app/screens/account-migration/hooks", () => ({
  useMigrationAccount: () => ({
    ensureAccount: mockEnsureAccount,
    isProvisioning: mockIsProvisioning,
    loading: false,
  }),
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
    mockEnsureAccount.mockResolvedValue("sc-account-1")
    mockIsProvisioning = false
    loadLocale("en")
  })

  it("renders the explainer title", async () => {
    renderScreen()
    await flushEffects()

    expect(screen.getByText(LL.AccountMigration.explainerTitle())).toBeTruthy()
  })

  it("reveals only the first checkbox initially and the rest as each is checked", async () => {
    renderScreen()
    await flushEffects()

    expect(screen.getAllByRole("checkbox")).toHaveLength(1)
    expect(screen.getByText(LL.AccountMigration.explainerCheck1())).toBeTruthy()

    fireEvent.press(screen.getByText(LL.AccountMigration.explainerCheck1()))
    expect(screen.getAllByRole("checkbox")).toHaveLength(2)

    fireEvent.press(screen.getByText(LL.AccountMigration.explainerCheck2()))
    expect(screen.getAllByRole("checkbox")).toHaveLength(3)

    fireEvent.press(screen.getByText(LL.AccountMigration.explainerCheck3()))
    expect(screen.getAllByRole("checkbox")).toHaveLength(4)

    fireEvent.press(screen.getByText(LL.AccountMigration.explainerCheck4()))
    expect(screen.getAllByRole("checkbox")).toHaveLength(5)
  })

  const acceptAllChecks = () => {
    fireEvent.press(screen.getByText(LL.AccountMigration.explainerCheck1()))
    fireEvent.press(screen.getByText(LL.AccountMigration.explainerCheck2()))
    fireEvent.press(screen.getByText(LL.AccountMigration.explainerCheck3()))
    fireEvent.press(screen.getByText(LL.AccountMigration.explainerCheck4()))
    fireEvent.press(screen.getByText(LL.AccountMigration.explainerCheck5()))
  }

  it("keeps the CTA inert until every checkbox is accepted, then provisions and navigates to the terms screen", async () => {
    renderScreen()
    await flushEffects()

    const cta = screen.getByText(LL.AccountMigration.explainerCta())

    fireEvent.press(cta)
    expect(mockEnsureAccount).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()

    acceptAllChecks()
    fireEvent.press(cta)

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("acceptTermsAndConditions", {
        flow: "migration",
      }),
    )
    expect(mockEnsureAccount).toHaveBeenCalledTimes(1)
  })

  it("re-disables the CTA when a box is unchecked after all were accepted", async () => {
    renderScreen()
    await flushEffects()

    acceptAllChecks()
    /** People change their mind: unticking a box must close the consent gate again. */
    fireEvent.press(screen.getByText(LL.AccountMigration.explainerCheck1()))

    const cta = screen.getByTestId("migration-explainer-cta")
    expect(cta.props.accessibilityState?.disabled).toBe(true)

    fireEvent.press(cta)
    expect(mockEnsureAccount).not.toHaveBeenCalled()
  })

  it("does not navigate when account provisioning fails", async () => {
    mockEnsureAccount.mockResolvedValue(null)
    renderScreen()
    await flushEffects()

    acceptAllChecks()
    fireEvent.press(screen.getByText(LL.AccountMigration.explainerCta()))

    await waitFor(() => expect(mockEnsureAccount).toHaveBeenCalled())
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("keeps the CTA disabled and busy while the wallet is being provisioned", async () => {
    mockIsProvisioning = true
    renderScreen()
    await flushEffects()

    acceptAllChecks()

    const cta = screen.getByTestId("migration-explainer-cta")
    expect(cta.props.accessibilityState?.disabled).toBe(true)
    expect(cta.props.accessibilityState?.busy).toBe(true)

    fireEvent.press(cta)
    expect(mockEnsureAccount).not.toHaveBeenCalled()
  })
})
