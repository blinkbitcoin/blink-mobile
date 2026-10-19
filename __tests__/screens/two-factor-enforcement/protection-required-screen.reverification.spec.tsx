import React from "react"
import { Alert, AlertButton } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { TwoFactorProtectionRequiredScreen } from "@app/screens/two-factor-enforcement"
import { TwoFactorMethod, TwoFactorTier } from "@app/types/two-factor-enforcement"
import { WalletCurrency } from "@app/graphql/generated"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

/**
 * The gate's re-verification with the real hook, where its sibling spec stubs the hook
 * out: what reaches the code screen is the route the gate hands the hook, and only this
 * path can say so, since the type checker accepts a hook called with no route at all.
 */

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    isFocused: () => true,
    addListener: () => () => {},
  }),
}))

jest.mock("@app/screens/account-migration/hooks/use-hardware-back-guard", () => ({
  useHardwareBackGuard: () => {},
}))

const mockEnforcement = {
  unmetTier: TwoFactorTier.Reminder as TwoFactorTier,
  remainingDismissals: 0,
  highBalanceCurrency: WalletCurrency.Btc as WalletCurrency,
  missingMethod: TwoFactorMethod.Email as TwoFactorMethod,
  unverifiedEmail: "someone@example.com" as string | null,
  registerDismissal: jest.fn(),
  consumeSessionStart: jest.fn(),
}
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => mockEnforcement,
}))

const mockEmailDelete = jest.fn()
const mockRegistrationInitiate = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useUserEmailDeleteMutation: () => [mockEmailDelete, { loading: false }],
  useUserEmailRegistrationInitiateMutation: () => [
    mockRegistrationInitiate,
    { loading: false },
  ],
}))

jest.mock("@app/utils/analytics", () => ({
  logTwoFactorPromptShown: jest.fn(),
  logTwoFactorPromptDismissed: jest.fn(),
  logTwoFactorSetupStarted: jest.fn(),
  logTwoFactorNonCustodialChosen: jest.fn(),
}))

const pressAlertOk = async () => {
  const [, , buttons] = jest.mocked(Alert.alert).mock.calls[0]
  const ok = (buttons as AlertButton[]).find(({ text }) => text === LL.common.ok())
  await act(async () => {
    await ok?.onPress?.()
  })
}

describe("TwoFactorProtectionRequiredScreen re-verification", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    jest.spyOn(Alert, "alert").mockImplementation(() => {})
    mockEmailDelete.mockResolvedValue({ data: {} })
    mockRegistrationInitiate.mockResolvedValue({
      data: {
        userEmailRegistrationInitiate: {
          errors: [],
          emailRegistrationId: "registration-id",
        },
      },
    })
  })

  it("hands the code screen the home as the route to return to", async () => {
    render(
      <ContextForScreen>
        <TwoFactorProtectionRequiredScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.addEmail()))
    await pressAlertOk()

    expect(mockEmailDelete).toHaveBeenCalledTimes(1)
    expect(mockRegistrationInitiate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith("emailRegistrationValidate", {
      emailRegistrationId: "registration-id",
      email: "someone@example.com",
      returnTo: "Primary",
    })
  })
})
