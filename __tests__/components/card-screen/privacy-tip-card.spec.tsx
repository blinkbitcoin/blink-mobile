import React from "react"
import { render } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { InfoCard } from "@app/components/card-screen/info-card"
import { PrivacyTipCard } from "@app/components/card-screen/privacy-tip-card"
import theme from "@app/rne-theme/theme"

import { ContextForScreen } from "../../screens/helper"

/** The order and the replacement invite an address that is not the member's home
 *  (D42, D123), with a friendly note rather than a warning. */
describe("PrivacyTipCard", () => {
  beforeEach(() => {
    loadLocale("en")
  })

  it("says where the card goes and suggests an address other than home", () => {
    const { getByText } = render(
      <ContextForScreen>
        <PrivacyTipCard />
      </ContextForScreen>,
    )

    expect(getByText("Privacy tip")).toBeTruthy()
    expect(
      getByText(
        "Card will be sent to this address in a discreet envelope. For increased privacy, you may want to send it to a different address than your home.",
      ),
    ).toBeTruthy()
  })

  it("draws the tip in the success color with the hidden-eye icon", () => {
    const rendered = render(
      <ContextForScreen>
        <PrivacyTipCard />
      </ContextForScreen>,
    )

    expect(rendered.UNSAFE_getByType(InfoCard).props).toMatchObject({
      icon: "eye-slash",
      titleColor: theme.lightColors?.success,
      iconColor: theme.lightColors?.success,
      size: "lg",
    })
  })
})
