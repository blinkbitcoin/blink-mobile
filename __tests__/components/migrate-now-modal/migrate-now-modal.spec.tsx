import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"

jest.mock("react-native-modal", () =>
  jest.requireActual("@mocks/react-native-modal-mock"),
)

import { MigrateNowModal } from "@app/components/migrate-now-modal"
import { WindDownReason } from "@app/types/wind-down"

loadLocale("en")

const TITLE = "Migrate now to a non-custodial account"
const AUG_31_2026_NOON_UTC = Date.UTC(2026, 7, 31, 12) / 1000

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

const renderModal = (overrides?: Partial<React.ComponentProps<typeof MigrateNowModal>>) =>
  render(
    wrap(
      <MigrateNowModal
        isVisible={true}
        toggleModal={jest.fn()}
        onMigrate={jest.fn()}
        deadlineTimestamp={AUG_31_2026_NOON_UTC}
        timezone="UTC"
        {...overrides}
      />,
    ),
  )

describe("MigrateNowModal", () => {
  it("renders the title and the body with the formatted deadline date", () => {
    const { getByText } = renderModal()

    expect(getByText(TITLE)).toBeTruthy()
    expect(getByText(/by the end of August 31\./)).toBeTruthy()
    expect(getByText(/You can no longer receive funds/)).toBeTruthy()
  })

  it("keeps the region copy for a region wind-down", () => {
    const { getByText } = renderModal({ reason: WindDownReason.Region })

    expect(getByText(/discontinued custodial service in your region/)).toBeTruthy()
  })

  it("gives a Level 0 account the trial copy, with no region wording", () => {
    const { getByText, queryByText } = renderModal({ reason: WindDownReason.LevelZero })

    expect(
      getByText(
        "You can no longer receive funds to this trial account. Blink is closing trial accounts and this account will be inactivated by the end of August 31.\n\nMigrate now to a non-custodial account.",
      ),
    ).toBeTruthy()
    expect(queryByText(/region|regulatory/i)).toBeNull()
  })

  it("starts the migration from the primary action without closing by itself", () => {
    const toggleModal = jest.fn()
    const onMigrate = jest.fn()
    const { getByText } = renderModal({ toggleModal, onMigrate })

    fireEvent.press(getByText("Migrate now"))

    expect(onMigrate).toHaveBeenCalledTimes(1)
    expect(toggleModal).not.toHaveBeenCalled()
  })

  it("dismisses the modal from the X icon", () => {
    const toggleModal = jest.fn()
    const { getByTestId } = renderModal({ toggleModal })

    fireEvent.press(getByTestId("icon-close"))

    expect(toggleModal).toHaveBeenCalledTimes(1)
  })

  it("renders nothing when isVisible is false", () => {
    const { queryByText } = renderModal({ isVisible: false })

    expect(queryByText(TITLE)).toBeNull()
  })
})
