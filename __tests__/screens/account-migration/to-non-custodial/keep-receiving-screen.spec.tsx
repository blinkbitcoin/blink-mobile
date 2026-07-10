import React from "react"
import { render, screen, fireEvent } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { MigrationKeepReceivingScreen } from "@app/screens/account-migration/to-non-custodial/keep-receiving-screen"
import { ContextForScreen } from "../../helper"
import { flushEffects } from "../../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const DOWNLOAD_HISTORY_ROUTE = "accountMigrationDownloadHistory"

const mockNavigate = jest.fn()
const mockReplace = jest.fn()
const mockUseAddressScreenQuery = jest.fn()

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

const mockNavigateToCheckpoint = jest.fn()
const mockReplaceToCheckpoint = jest.fn()
let mockHasResumableCheckpoint = false
let mockHasTransactions = true
let mockTransactionsLoading = false

jest.mock("@app/screens/account-migration/hooks", () => ({
  useMigrationCheckpoint: () => ({
    navigateToCheckpoint: mockNavigateToCheckpoint,
    replaceToCheckpoint: mockReplaceToCheckpoint,
    hasResumableCheckpoint: mockHasResumableCheckpoint,
    loading: false,
  }),
  useHasTransactions: () => ({
    hasTransactions: mockHasTransactions,
    loading: mockTransactionsLoading,
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
    mockHasResumableCheckpoint = false
    mockHasTransactions = true
    mockTransactionsLoading = false
    mockUseAddressScreenQuery.mockReturnValue({
      data: { me: { username: "satoshin21" } },
      loading: false,
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

  it("goes to the download-history step when the CTA is pressed", async () => {
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LL.AccountMigration.keepReceivingCta()))

    expect(mockNavigate).toHaveBeenCalledWith(DOWNLOAD_HISTORY_ROUTE)
  })

  it("skips the download step when the account has no transactions", async () => {
    mockHasTransactions = false
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LL.AccountMigration.keepReceivingCta()))

    expect(mockNavigateToCheckpoint).toHaveBeenCalledTimes(1)
  })

  it("returns to the checkpoint when resuming instead of re-offering the download", async () => {
    mockHasResumableCheckpoint = true
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LL.AccountMigration.keepReceivingCta()))

    expect(mockNavigateToCheckpoint).toHaveBeenCalledTimes(1)
  })

  it("renders nothing while the transaction check is loading", async () => {
    mockTransactionsLoading = true
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

  it("renders nothing while the address is still loading", async () => {
    mockUseAddressScreenQuery.mockReturnValue({ data: undefined, loading: true })
    renderScreen()
    await flushEffects()

    expect(screen.queryByText(LL.AccountMigration.keepReceivingTitle())).toBeNull()
    expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
  })
})
