import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { MigrationReminderBulletin } from "@app/components/migration-reminder-bulletin"

loadLocale("en")

const AUG_31_2026_NOON_UTC = Date.UTC(2026, 7, 31, 12) / 1000
const AUG_10_2026_NOON_UTC = Date.UTC(2026, 7, 10, 12) / 1000

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
