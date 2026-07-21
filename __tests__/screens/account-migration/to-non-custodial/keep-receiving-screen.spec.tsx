import React from "react"
import { render, screen, fireEvent } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { MigrationKeepReceivingScreen } from "@app/screens/account-migration/to-non-custodial/keep-receiving-screen"
import { ContextForScreen } from "../../helper"
import { flushEffects } from "../../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()
const mockReplace = jest.fn()
const mockUseAddressScreenQuery = jest.fn()
const mockRefetch = jest.fn()

let mockIsFocused = true

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, replace: mockReplace }),
  useIsFocused: () => mockIsFocused,
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useAddressScreenQuery: () => mockUseAddressScreenQuery(),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => true,
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const mockGoToNextStep = jest.fn()
const mockReplaceToCheckpoint = jest.fn()
let mockNextStepLoading = false

jest.mock("@app/screens/account-migration/hooks", () => ({
  ...jest.requireActual("@app/screens/account-migration/hooks"),
  useMigrationNextStep: () => ({
    goToNextStep: mockGoToNextStep,
    replaceToCheckpoint: mockReplaceToCheckpoint,
    loading: mockNextStepLoading,
  }),
}))

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({
    appConfig: {
      galoyInstance: { lnAddressHostname: "blink.sv", name: "Blink" },
    },
  }),
}))

const renderScreen = () =>
  render(
    <ContextForScreen>
      <MigrationKeepReceivingScreen />
    </ContextForScreen>,
  )

describe("MigrationKeepReceivingScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockIsFocused = true
    mockNextStepLoading = false
    mockRefetch.mockResolvedValue({})
    mockUseAddressScreenQuery.mockReturnValue({
      data: { me: { username: "satoshin21" } },
      loading: false,
      refetch: mockRefetch,
    })
  })

  it("renders the lightning-address hero, title, body and address", async () => {
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("icon-lightning-address")).toBeTruthy()
    expect(screen.getByText(LL.AccountMigration.keepReceivingTitle())).toBeTruthy()
    expect(screen.getByText(LL.AccountMigration.keepReceivingBody())).toBeTruthy()
    expect(
      screen.getByText(LL.AccountMigration.keepReceivingLnAddressLabel()),
    ).toBeTruthy()
    expect(screen.getByText("satoshin21@blink.sv")).toBeTruthy()
  })

  it("truncates an overflowing lightning address instead of overflowing the screen", async () => {
    mockUseAddressScreenQuery.mockReturnValue({
      data: { me: { username: "a-very-long-lightning-address-username-that-overflows" } },
      loading: false,
    })
    renderScreen()
    await flushEffects()

    const address = screen.getByTestId("migration-ln-address")
    expect(address.props.numberOfLines).toBe(1)
    expect(address.props.ellipsizeMode).toBe("middle")
  })

  it("hands off to the flow's next step when the CTA is pressed", async () => {
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LL.AccountMigration.keepReceivingCta()))

    expect(mockGoToNextStep).toHaveBeenCalledTimes(1)
  })

  it("renders nothing while the next-step checks are loading", async () => {
    mockNextStepLoading = true
    renderScreen()
    await flushEffects()

    expect(screen.queryByText(LL.AccountMigration.keepReceivingTitle())).toBeNull()
  })

  it("skips itself when the user has no lightning address", async () => {
    mockUseAddressScreenQuery.mockReturnValue({
      data: { me: { username: null } },
      loading: false,
    })
    renderScreen()
    await flushEffects()

    expect(mockReplaceToCheckpoint).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(LL.AccountMigration.keepReceivingTitle())).toBeNull()
  })

  it("does not replace itself from the background when the session swap drops the username", async () => {
    mockIsFocused = false
    mockUseAddressScreenQuery.mockReturnValue({ data: { me: {} }, loading: false })
    renderScreen()
    await flushEffects()

    expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
  })

  it("shows a spinner (not a blank screen) while the address is still loading", async () => {
    mockUseAddressScreenQuery.mockReturnValue({ data: undefined, loading: true })
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("migration-keep-receiving-loading")).toBeTruthy()
    expect(screen.queryByText(LL.AccountMigration.keepReceivingTitle())).toBeNull()
    expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
  })

  it("shows a retry state, not a spinner, and does not skip when the address query errors", async () => {
    mockUseAddressScreenQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: new Error("offline"),
      refetch: mockRefetch,
    })
    renderScreen()
    await flushEffects()

    expect(screen.getByText(LL.errors.generic())).toBeTruthy()
    expect(screen.getByTestId("migration-keep-receiving-retry")).toBeTruthy()
    /** The spinner-forever bug: an errored query must render a way forward, not a spinner. */
    expect(screen.queryByTestId("migration-keep-receiving-loading")).toBeNull()
    /** A failed query must not read as "no address" and skip the warning. */
    expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
  })

  it("refetches the address when Try Again is pressed on the error state", async () => {
    mockUseAddressScreenQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: new Error("offline"),
      refetch: mockRefetch,
    })
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LL.common.tryAgain()))
    await flushEffects()

    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it("keeps the retry available and reports when the refetch itself fails", async () => {
    mockRefetch.mockRejectedValueOnce(new Error("still offline"))
    mockUseAddressScreenQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: new Error("offline"),
      refetch: mockRefetch,
    })
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LL.common.tryAgain()))
    await flushEffects()

    expect(mockReportError).toHaveBeenCalledWith(
      "Migration keep-receiving address retry",
      expect.any(Error),
    )
    /** A failed retry must leave the button tappable for another attempt, not lock it. */
    expect(screen.getByTestId("migration-keep-receiving-retry")).toBeTruthy()
  })

  it("advances the flow when Continue is pressed on the error state, without blocking the migration", async () => {
    mockUseAddressScreenQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: new Error("offline"),
      refetch: mockRefetch,
    })
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LL.common.continue()))

    expect(mockGoToNextStep).toHaveBeenCalledTimes(1)
    expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
  })
})
