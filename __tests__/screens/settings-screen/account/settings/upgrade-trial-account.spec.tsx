import React from "react"
import { render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { light } from "@app/rne-theme/colors"
import theme from "@app/rne-theme/theme"
import { UpgradeTrialAccount } from "@app/screens/settings-screen/account/settings/upgrade-trial-account"

import { surfaceColor } from "../../../../helpers/surface-color"

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: jest.fn(),
}))

jest.mock("@app/graphql/level-context", () => ({
  AccountLevel: { Zero: "ZERO", One: "ONE" },
  useLevel: () => ({ currentLevel: "ZERO" }),
}))

jest.mock(
  "@app/screens/settings-screen/account/show-warning-secure-account-hook",
  () => ({
    useShowWarningSecureAccount: () => false,
  }),
)

jest.mock("@app/components/upgrade-account-modal", () => ({
  TrialAccountLimitsModal: () => null,
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: {
        trialAccount: () => "Trial account",
        backupAccount: () => "Backup account",
      },
      AccountScreen: {
        itsATrialAccount: () => "This is a trial account",
        fundsMoreThan5Dollars: () => "Funds over $5",
      },
    },
  }),
}))

/** The backup button is a critical action, so the trial card keeps the
 *  tappable grey5 instead of the static grey7 (blink-wip#1871). */
describe("UpgradeTrialAccount", () => {
  it("keeps the trial card grey5 while it shows the backup action", () => {
    const { getByText } = render(
      <ThemeProvider theme={theme}>
        <UpgradeTrialAccount />
      </ThemeProvider>,
    )

    expect(getByText("Backup account")).toBeTruthy()
    expect(surfaceColor(getByText("This is a trial account"))).toBe(light.grey5)
  })
})
