import React from "react"
import { fireEvent, render, waitFor } from "@testing-library/react-native"

import { MockedProvider, MockedResponse } from "@apollo/client/testing"
import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { AccountLimitsByLevelDocument } from "@app/graphql/generated"
import { FALLBACK_LEVEL1_DAILY_LIMIT_CENTS } from "@app/hooks/use-level1-daily-limit"

jest.mock("react-native-modal", () =>
  jest.requireActual("@mocks/react-native-modal-mock"),
)

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

import { TrialAccountLimitsModal } from "@app/components/upgrade-account-modal"

loadLocale("en")
loadLocale("es")
loadLocale("de")
const LL = i18nObject("en")

const accountLimitsMock = (withdrawalCents: number) => ({
  request: { query: AccountLimitsByLevelDocument },
  result: {
    data: {
      globals: {
        __typename: "Globals" as const,
        accountLimitsByLevel: [
          {
            __typename: "AccountLevelLimits" as const,
            level: "ONE",
            withdrawal: withdrawalCents,
          },
        ],
      },
    },
  },
})

const wrap = (
  ui: React.ReactElement,
  mocks: ReadonlyArray<MockedResponse> = [],
  locale: Parameters<typeof i18nObject>[0] = "en",
) => (
  <MockedProvider mocks={mocks}>
    <ThemeProvider>
      <TypesafeI18n locale={locale}>{ui}</TypesafeI18n>
    </ThemeProvider>
  </MockedProvider>
)

describe("TrialAccountLimitsModal", () => {
  beforeEach(() => mockNavigate.mockClear())

  it("sends the upgrade CTA to phone login as an account creation", () => {
    // The route type is asserted as the literal wire value, not as
    // PhoneLoginInitiateType.CreateAccount: reading the constant the component
    // reads makes the assertion move with any change to its value, so only a
    // rename would fail — and tsc already catches that.
    const beforeSubmit = jest.fn()
    const closeModal = jest.fn()
    const { getByText } = render(
      wrap(
        <TrialAccountLimitsModal
          isVisible={true}
          closeModal={closeModal}
          beforeSubmit={beforeSubmit}
        />,
      ),
    )

    fireEvent.press(getByText(LL.UpgradeAccountModal.upgradeToLevel({ level: 1 })))

    expect(beforeSubmit).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith(
      "login",
      expect.objectContaining({ type: "CreateAccount", onboarding: true }),
    )
    expect(closeModal).toHaveBeenCalledTimes(1)
  })

  it("renders the level 1 benefit items", async () => {
    const { getByText } = render(
      wrap(<TrialAccountLimitsModal isVisible={true} closeModal={jest.fn()} />, [
        accountLimitsMock(99900),
      ]),
    )

    expect(getByText(LL.GetStartedScreen.trialAccountLimits.modalTitle())).toBeTruthy()
    expect(
      getByText(LL.GetStartedScreen.trialAccountLimits.recoveryOption(), {
        exact: false,
      }),
    ).toBeTruthy()
    expect(
      getByText(LL.GetStartedScreen.trialAccountLimits.onchainReceive(), {
        exact: false,
      }),
    ).toBeTruthy()
    await waitFor(() => expect(getByText("USD 999", { exact: false })).toBeTruthy())
  })

  it("shows the daily limit served by the backend, not a hardcoded value", async () => {
    // blink#750 exposes the enforced limits on globals; the copy must follow it
    const { getByText } = render(
      wrap(<TrialAccountLimitsModal isVisible={true} closeModal={jest.fn()} />, [
        accountLimitsMock(150000),
      ]),
    )

    await waitFor(() =>
      expect(
        getByText("USD 1,500 daily transaction limit", { exact: false }),
      ).toBeTruthy(),
    )
  })

  it("falls back to the audited USD 999 limit when the backend has no limits field", async () => {
    // SSF audit finding (blink-wip#739): the enforced level 1 limit is $999/day.
    // Older production APIs reject the accountLimitsByLevel query entirely, so
    // the fallback must still advertise the correct value.
    const errorMock = {
      request: { query: AccountLimitsByLevelDocument },
      error: new Error("cannot query field 'accountLimitsByLevel' on type 'Globals'"),
    }
    const { getByText } = render(
      wrap(<TrialAccountLimitsModal isVisible={true} closeModal={jest.fn()} />, [
        errorMock,
      ]),
    )

    await waitFor(() =>
      expect(getByText("USD 999 daily transaction limit", { exact: false })).toBeTruthy(),
    )
  })

  it("interpolates the backend amount into a non-English locale", async () => {
    // Every other assertion here runs in `en`, so a locale that drops the
    // placeholder — or reverts to the pre-audit hardcoded string — renders
    // untested. Spanish stands in for the other 29.
    const { getByText } = render(
      wrap(
        <TrialAccountLimitsModal isVisible={true} closeModal={jest.fn()} />,
        [accountLimitsMock(150000)],
        "es",
      ),
    )

    // "1500", not the English "1,500": Spanish leaves four-digit numbers
    // ungrouped.
    await waitFor(() =>
      expect(
        getByText("Límite de transacciones diarias de USD 1500", { exact: false }),
      ).toBeTruthy(),
    )
  })

  it("groups the amount for the reader's language, not for English", async () => {
    // German's thousands separator is the character English uses as a decimal
    // point, so an en-US-formatted "1,500" does not merely look foreign there —
    // it reads as one and a half.
    const { getByText } = render(
      wrap(
        <TrialAccountLimitsModal isVisible={true} closeModal={jest.fn()} />,
        [accountLimitsMock(150000)],
        "de",
      ),
    )

    await waitFor(() => expect(getByText("USD 1.500", { exact: false })).toBeTruthy())
  })

  it("keeps the fallback pinned to the audited enforced limit", () => {
    expect(FALLBACK_LEVEL1_DAILY_LIMIT_CENTS).toBe(99900)
    expect(LL.GetStartedScreen.trialAccountLimits.dailyLimit({ limit: "999" })).toContain(
      "USD 999",
    )
    expect(
      LL.OnboardingScreen.welcomeLevel1.dailyLimitDescription({ limit: "999" }),
    ).toContain("USD 999")
  })
})
