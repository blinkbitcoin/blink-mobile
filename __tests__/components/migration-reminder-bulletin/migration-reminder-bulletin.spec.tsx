import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { MigrationReminderBulletin } from "@app/components/migration-reminder-bulletin"
import { WindDownReason, WindDownStatus } from "@app/types/wind-down"

loadLocale("en")

const AUG_31_2026_NOON_UTC = Date.UTC(2026, 7, 31, 12) / 1000
const AUG_10_2026_NOON_UTC = Date.UTC(2026, 7, 10, 12) / 1000
const AUG_31_2026_EARLY_UTC = Date.UTC(2026, 7, 31, 1) / 1000

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

const renderBulletin = (
  overrides?: Partial<React.ComponentProps<typeof MigrationReminderBulletin>>,
) =>
  render(
    wrap(
      <MigrationReminderBulletin
        onMigrate={jest.fn()}
        phase={WindDownStatus.PreCutoff}
        reason={WindDownReason.Region}
        deadlineTimestamp={AUG_31_2026_NOON_UTC}
        receiveDisabledTimestamp={AUG_10_2026_NOON_UTC}
        timezone="UTC"
        {...overrides}
      />,
    ),
  )

describe("MigrationReminderBulletin", () => {
  it("renders the title, the body with both formatted dates, and the migrate CTA", () => {
    const { getByText } = renderBulletin()

    expect(getByText("Important")).toBeTruthy()
    expect(getByText(/before August 31/)).toBeTruthy()
    expect(getByText(/Receiving stops August 10/)).toBeTruthy()
    expect(getByText("Migrate")).toBeTruthy()
  })

  /** The pre-cutoff body announces the receive cutoff as a future event; past it that
   *  sentence would be dated before the day it is read. */
  it("drops the receive-cutoff sentence once receiving has stopped", () => {
    const { getByText, queryByText } = renderBulletin({
      phase: WindDownStatus.ReceiveDisabled,
    })

    expect(getByText(/Receiving has stopped/)).toBeTruthy()
    expect(getByText(/before August 31/)).toBeTruthy()
    expect(queryByText(/Receiving stops August 10/)).toBeNull()
  })

  it("shows one date when the region cutoff falls on the deadline day", () => {
    const { getByText, queryByText } = renderBulletin({
      receiveDisabledTimestamp: AUG_31_2026_EARLY_UTC,
    })

    expect(
      getByText(
        "Move to a non-custodial account via guided migration, or withdraw, before August 31 — everything moves in a few taps.",
      ),
    ).toBeTruthy()
    expect(queryByText(/Receiving stops/)).toBeNull()
  })

  it("keeps the two-date body for a missing reason, like the region", () => {
    const { getByText } = renderBulletin({ reason: undefined })

    expect(getByText(/Receiving stops August 10/)).toBeTruthy()
  })

  it("gives a Level 0 account the single-date trial copy before the cutoff", () => {
    const { getByText, queryByText } = renderBulletin({
      reason: WindDownReason.LevelZero,
    })

    expect(
      getByText(
        "Move to a non-custodial account via guided migration, or withdraw, before August 31.",
      ),
    ).toBeTruthy()
    expect(queryByText(/Receiving stops/)).toBeNull()
    expect(queryByText(/region|regulatory/i)).toBeNull()
  })

  it("keeps the receive-disabled body for a Level 0 account once receiving stops", () => {
    const { getByText } = renderBulletin({
      reason: WindDownReason.LevelZero,
      phase: WindDownStatus.ReceiveDisabled,
    })

    expect(
      getByText(
        "Receiving has stopped. Move to a non-custodial account via guided migration, or withdraw, before August 31.",
      ),
    ).toBeTruthy()
  })

  it("keeps the title and the migrate CTA across both phases", () => {
    const { getByText } = renderBulletin({ phase: WindDownStatus.ReceiveDisabled })

    expect(getByText("Important")).toBeTruthy()
    expect(getByText("Migrate")).toBeTruthy()
  })

  it("starts the migration from the CTA", () => {
    const onMigrate = jest.fn()
    const { getByText } = renderBulletin({ onMigrate })

    fireEvent.press(getByText("Migrate"))

    expect(onMigrate).toHaveBeenCalledTimes(1)
  })

  it("is non-dismissible: renders no close control", () => {
    const { queryByTestId } = renderBulletin()

    expect(queryByTestId("close")).toBeNull()
  })
})
