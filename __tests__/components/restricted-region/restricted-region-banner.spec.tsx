import React from "react"

import { render } from "@testing-library/react-native"
import { ThemeProvider, useTheme } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

jest.mock("@app/utils/ip-country-lookup")

import { RestrictedRegionBanner } from "@app/components/restricted-region"

loadLocale("en")
const LL = i18nObject("en")

/** Reads the palette from inside the same provider the banner renders under, so the
 *  colour assertions follow the theme instead of hardcoding hexes. */
let themeColors: { primary: string; grey5: string } | undefined
const ThemeProbe: React.FC = () => {
  themeColors = useTheme().theme.colors
  return null
}

const palette = () => {
  if (!themeColors) throw new Error("theme probe did not render")
  return themeColors
}

const renderBanner = () =>
  render(
    <ThemeProvider>
      <TypesafeI18n locale="en">
        <ThemeProbe />
        <RestrictedRegionBanner />
      </TypesafeI18n>
    </ThemeProvider>,
  )

describe("RestrictedRegionBanner", () => {
  it("shows the fixed copy", () => {
    const { getByText, getByTestId } = renderBanner()

    expect(getByTestId("restricted-region-banner")).toBeTruthy()
    expect(getByText(LL.RestrictedRegion.title())).toBeTruthy()
    expect(
      getByText(`${LL.RestrictedRegion.body()}\n\n${LL.RestrictedRegion.bodyReturn()}`),
    ).toBeTruthy()
  })

  /** Sits directly above the backup nudge in Settings, which renders through
   *  SettingsCard with primary border and title over grey5. Two warning banners stacked
   *  in one list must not disagree on their colours. */
  it("wears the same primary border and grey5 fill as the backup nudge", () => {
    const { getByTestId, getByText } = renderBanner()
    const { primary, grey5 } = palette()

    expect(getByTestId("restricted-region-banner")).toHaveStyle({
      borderColor: primary,
      backgroundColor: grey5,
    })
    expect(getByText(LL.RestrictedRegion.title())).toHaveStyle({ color: primary })
  })
})
