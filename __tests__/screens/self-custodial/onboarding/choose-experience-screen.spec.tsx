import React from "react"
import { Pressable, Text } from "react-native"

import { fireEvent, render, within } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { IconHero } from "@app/components/icon-hero"
import { ChooseExperienceScreen } from "@app/screens/self-custodial/onboarding/choose-experience-screen"
import { AccountMode } from "@app/types/account"

import { ContextForScreen } from "../../helper"
import { flushEffects } from "../../../helpers/flush-effects"

const mockNavigate = jest.fn()
type OnContinue =
  | { route: "acceptTermsAndConditions" }
  | { route: "selfCustodialBackupSuccess"; accountId: string }
  | { route: "accountMigrationBalancesOverview"; accountId: string }
let mockOnContinue: OnContinue = {
  route: "selfCustodialBackupSuccess",
  accountId: "sc-account-1",
}

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { onContinue: mockOnContinue } }),
}))

const mockSetAccountMode = jest.fn()
jest.mock("@app/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ setAccountMode: mockSetAccountMode }),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({ title, onPress }: { title: string; onPress: () => void }) => (
    <Pressable testID={`primary-${title}`} onPress={onPress}>
      <Text>{title}</Text>
    </Pressable>
  ),
}))

jest.mock("@app/components/icon-hero", () => ({
  IconHero: jest.fn(({ title, subtitle }: { title: string; subtitle: string }) => (
    <>
      <Text>{title}</Text>
      <Text>{subtitle}</Text>
    </>
  )),
}))

loadLocale("en")
const LL = i18nObject("en")
const continueTestId = `primary-${LL.ChooseExperienceScreen.continueButton()}`

const renderScreen = async () => {
  const utils = render(
    <ContextForScreen>
      <ChooseExperienceScreen />
    </ContextForScreen>,
  )
  await flushEffects()
  return utils
}

describe("ChooseExperienceScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockOnContinue = { route: "selfCustodialBackupSuccess", accountId: "sc-account-1" }
  })

  it("renders the location hero with the title", async () => {
    await renderScreen()

    const iconHeroMock = IconHero as unknown as jest.Mock
    const props = iconHeroMock.mock.calls[0][0]

    expect(props.icon).toBe("location")
    expect(props.title).toBe(LL.ChooseExperienceScreen.title())
  })

  it("renders both mode options", async () => {
    const { getByTestId } = await renderScreen()

    expect(getByTestId("mode-enhanced")).toBeTruthy()
    expect(getByTestId("mode-anon")).toBeTruthy()
  })

  it("marks Enhanced with the location icon and Anon with its slashed pair", async () => {
    const { getByTestId } = await renderScreen()

    expect(within(getByTestId("mode-enhanced")).getByTestId("icon-location")).toBeTruthy()
    expect(
      within(getByTestId("mode-anon")).getByTestId("icon-location-slash"),
    ).toBeTruthy()
  })

  it("defaults to Enhanced when the user continues without changing the selection", async () => {
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId(continueTestId))

    expect(mockSetAccountMode).toHaveBeenCalledWith("sc-account-1", AccountMode.Enhanced)
  })

  it("persists Anon when the user selects it before continuing", async () => {
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId("mode-anon"))
    fireEvent.press(getByTestId(continueTestId))

    expect(mockSetAccountMode).toHaveBeenCalledWith("sc-account-1", AccountMode.Anon)
  })

  it("forwards to the backup success screen", async () => {
    mockOnContinue = {
      route: "selfCustodialBackupSuccess",
      accountId: "sc-account-1",
    }
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId(continueTestId))

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSuccess")
  })

  it("forwards to the migration balances overview during a migration", async () => {
    mockOnContinue = {
      route: "accountMigrationBalancesOverview",
      accountId: "sc-account-1",
    }
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId(continueTestId))

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationBalancesOverview")
  })

  it("carries the mode through terms without storing it when the account is new", async () => {
    mockOnContinue = { route: "acceptTermsAndConditions" }
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId(continueTestId))

    expect(mockNavigate).toHaveBeenCalledWith("acceptTermsAndConditions", {
      flow: "selfCustodial",
      mode: AccountMode.Enhanced,
    })
    expect(mockSetAccountMode).not.toHaveBeenCalled()
  })
})
