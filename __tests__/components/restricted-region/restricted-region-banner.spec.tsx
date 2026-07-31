import React from "react"

import { render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

jest.mock("@app/utils/ip-country-lookup")

import { RestrictedRegionBanner } from "@app/components/restricted-region"

loadLocale("en")
const LL = i18nObject("en")

describe("RestrictedRegionBanner", () => {
  it("shows the fixed copy", () => {
    const { getByText, getByTestId } = render(
      <ThemeProvider>
        <TypesafeI18n locale="en">
          <RestrictedRegionBanner />
        </TypesafeI18n>
      </ThemeProvider>,
    )

    expect(getByTestId("restricted-region-banner")).toBeTruthy()
    expect(getByText(LL.RestrictedRegion.title())).toBeTruthy()
    expect(
      getByText(`${LL.RestrictedRegion.body()}\n\n${LL.RestrictedRegion.bodyReturn()}`),
    ).toBeTruthy()
  })
})
