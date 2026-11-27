import React from "react"
import { TouchableOpacity } from "react-native"
import { render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { OffboardOnlyBulletin } from "@app/components/offboard-only-bulletin"
import { WindDownStatus } from "@app/types/wind-down"

loadLocale("en")

const SEP_30_2026_NOON_UTC = Date.UTC(2026, 8, 30, 12) / 1000
const SEP_30_2026_EARLY_UTC = Date.UTC(2026, 8, 30, 1) / 1000
const OCT_1_2026_NOON_UTC = Date.UTC(2026, 9, 1, 12) / 1000
const SEP_15_2026_NOON_UTC = Date.UTC(2026, 8, 15, 12) / 1000

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

const renderBulletin = (
  overrides?: Partial<React.ComponentProps<typeof OffboardOnlyBulletin>>,
) =>
  render(
    wrap(
      <OffboardOnlyBulletin
        status={WindDownStatus.PreCutoff}
        deadlineTimestamp={SEP_30_2026_NOON_UTC}
        receiveDisabledTimestamp={SEP_15_2026_NOON_UTC}
        timezone="UTC"
        {...overrides}
      />,
    ),
  )

const REGION_SENTENCE = "Blink cannot offer custodial accounts in your region."
const ERROR_SENTENCE =
  "If you believe your account has been affected in error, you can verify your current residence in the app."

describe("OffboardOnlyBulletin", () => {
  it("renders the title and both server dates while the cutoff is still ahead", () => {
    const { getByText } = renderBulletin()

    expect(getByText("Important")).toBeTruthy()
    expect(
      getByText(
        `${REGION_SENTENCE} Withdraw your funds before September 30 — free of any Blink charge. Receiving stops September 15. ${ERROR_SENTENCE}`,
      ),
    ).toBeTruthy()
  })

  it("shows one date when the cutoff falls on the deadline day", () => {
    const { getByText, queryByText } = renderBulletin({
      receiveDisabledTimestamp: SEP_30_2026_EARLY_UTC,
    })

    expect(
      getByText(
        `${REGION_SENTENCE} Withdraw your funds before September 30 — free of any Blink charge. ${ERROR_SENTENCE}`,
      ),
    ).toBeTruthy()
    expect(queryByText(/Receiving stops/)).toBeNull()
  })

  it("shows one date when the cutoff falls after the deadline day", () => {
    const { queryByText } = renderBulletin({
      receiveDisabledTimestamp: OCT_1_2026_NOON_UTC,
    })

    expect(queryByText(/before September 30/)).toBeTruthy()
    expect(queryByText(/Receiving stops/)).toBeNull()
  })

  it("says receiving is off once the server reports it disabled", () => {
    const { getByText, queryByText } = renderBulletin({
      status: WindDownStatus.ReceiveDisabled,
    })

    expect(
      getByText(
        `${REGION_SENTENCE} Withdraw your funds before September 30 — free of any Blink charge. Receiving is off. ${ERROR_SENTENCE}`,
      ),
    ).toBeTruthy()
    expect(queryByText(/Receiving stops/)).toBeNull()
  })

  it("says receiving is off for a closed account, never a past cutoff", () => {
    const { getByText, queryByText } = renderBulletin({
      status: WindDownStatus.GatedClosed,
    })

    expect(
      getByText(
        `${REGION_SENTENCE} Withdraw your funds before September 30 — free of any Blink charge. Receiving is off. ${ERROR_SENTENCE}`,
      ),
    ).toBeTruthy()
    expect(queryByText(/Receiving stops/)).toBeNull()
  })

  it("renders the dates in the backend timezone", () => {
    /** 23:30 UTC on Sep 29 is already Sep 30 in Dubai (UTC+4). */
    const { getByText } = renderBulletin({
      deadlineTimestamp: Date.UTC(2026, 8, 29, 23, 30) / 1000,
      timezone: "Asia/Dubai",
    })

    expect(getByText(/before September 30/)).toBeTruthy()
  })

  it("is non-dismissible: renders no close control", () => {
    const { queryByTestId } = renderBulletin()

    expect(queryByTestId("close")).toBeNull()
  })

  it("is text-only: renders no button and no touchable container", () => {
    const screen = renderBulletin()

    expect(screen.UNSAFE_queryByType(TouchableOpacity)).toBeNull()
  })
})
