import React from "react"
import { TouchableOpacity } from "react-native"
import { render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { OffboardOnlyBulletin } from "@app/components/offboard-only-bulletin"

loadLocale("en")

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

const renderBulletin = () => render(wrap(<OffboardOnlyBulletin />))

describe("OffboardOnlyBulletin", () => {
  it("renders the title and the withdraw copy with both dates", () => {
    const { getByText } = renderBulletin()

    expect(getByText("Important")).toBeTruthy()
    expect(
      getByText(/registered in a region where we cannot offer accounts/),
    ).toBeTruthy()
    expect(getByText(/Withdraw your funds before August 31/)).toBeTruthy()
    expect(getByText(/Receiving stops August 10/)).toBeTruthy()
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
