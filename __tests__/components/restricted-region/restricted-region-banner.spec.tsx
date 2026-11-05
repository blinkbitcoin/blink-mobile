import React from "react"

import { render } from "@testing-library/react-native"
import { ThemeProvider, useTheme } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import theme from "@app/rne-theme/theme"

jest.mock("@app/utils/ip-country-lookup")

import { RestrictedRegionBanner } from "@app/components/restricted-region"

loadLocale("en")
const LL = i18nObject("en")

/** Reads the palette from inside the same provider the banner renders under, so the
 *  colour assertions follow the theme instead of hardcoding hexes. */
let themeColors: { primary: string; grey7: string } | undefined
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
    <ThemeProvider theme={theme}>
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

  /** Shares the backup nudge's primary border, but nothing on it is tappable, so it
   *  takes the static grey7 fill where the nudge, a SettingsCard, keeps grey5. */
  it("wears the primary border on the static grey7 fill", () => {
    const { getByTestId, getByText } = renderBanner()
    const { primary, grey7 } = palette()

    expect(getByTestId("restricted-region-banner")).toHaveStyle({
      borderColor: primary,
      backgroundColor: grey7,
    })
    expect(getByText(LL.RestrictedRegion.title())).toHaveStyle({ color: primary })
  })
})
