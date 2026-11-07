import React from "react"
import { StyleSheet } from "react-native"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloyTertiaryButton } from "@app/components/atomic/galoy-tertiary-button"
import { WalletCurrency } from "@app/graphql/generated"
import theme from "@app/rne-theme/theme"
import { SendBitcoinDetailsExtraInfo } from "@app/screens/send-bitcoin-screen/send-bitcoin-details-extra-info"
import {
  AmountInvalidReason,
  AmountStatus,
  LimitType,
} from "@app/screens/send-bitcoin-screen/payment-details"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: jest.fn(),
}))

jest.mock("@app/components/upgrade-account-modal", () => ({
  TrialAccountLimitsModal: () => null,
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ formatMoneyAmount: () => "$418.90" }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      SendBitcoinScreen: {
        amountExceedsLimit: ({ limit }: { limit: string }) =>
          `Amount exceeds your remaining daily limit of ${limit}`,
        upgradeAccountToIncreaseLimit: () => "Upgrade your account",
      },
      TransactionLimitsScreen: { increaseLimits: () => "Increase your limits" },
    },
  }),
}))

const overLimit: AmountStatus = {
  validAmount: false,
  invalidReason: AmountInvalidReason.InsufficientLimit,
  remainingLimit: { amount: 41890, currency: WalletCurrency.Usd, currencyCode: "USD" },
  limitType: LimitType.Withdrawal,
}

const renderOverLimit = () =>
  render(
    <ThemeProvider theme={theme}>
      <SendBitcoinDetailsExtraInfo amountStatus={overLimit} currentLevel="ONE" />
    </ThemeProvider>,
  )

describe("SendBitcoinDetailsExtraInfo over the daily limit", () => {
  it("offers Increase your limits as a tertiary action, not a second CTA", () => {
    renderOverLimit()

    const increaseLimits = screen.UNSAFE_getByType(GaloyTertiaryButton)

    expect(screen.UNSAFE_queryByType(GaloyPrimaryButton)).toBeNull()
    expect(increaseLimits.props.clear).toBe(true)
    expect(StyleSheet.flatten(increaseLimits.props.containerStyle).marginBottom).toBe(10)
  })

  it("opens the onboarding flow from Increase your limits", () => {
    renderOverLimit()

    fireEvent.press(screen.getByText("Increase your limits"))

    expect(mockNavigate).toHaveBeenCalledWith("fullOnboardingFlow")
  })
})
