import React from "react"
import { render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import {
  DepositErrorReason,
  DepositStatus,
  type PendingDeposit,
} from "@app/types/payment.types"

import { DepositErrorMessage } from "@app/screens/unclaimed-deposits/deposit-error-message"

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      UnclaimedDeposit: {
        feeExceeded: ({ requiredFee }: { requiredFee: number }) =>
          `Network fee too high (need ${requiredFee} sats)`,
        belowDustLimit: () => "Deposit too small after fees",
        missingUtxo: () => "Deposit no longer available on network",
        genericError: ({ error }: { error: string }) => `Unable to claim: ${error}`,
        error: () => "Unknown error",
      },
    },
  }),
}))

const renderWith = (deposit: PendingDeposit) =>
  render(
    <ThemeProvider theme={theme}>
      <DepositErrorMessage deposit={deposit} />
    </ThemeProvider>,
  )

const baseDeposit: PendingDeposit = {
  id: "tx:0",
  txid: "tx",
  vout: 0,
  amount: { amount: 1000, currency: "BTC", currencyCode: "BTC" },
  status: DepositStatus.Error,
  errorReason: null,
}

describe("DepositErrorMessage", () => {
  it("renders nothing when there is no errorReason", () => {
    const { toJSON } = renderWith({ ...baseDeposit, errorReason: null })

    expect(toJSON()).toBeNull()
  })

  it("shows the fee-exceeded warning with the required fee", () => {
    const { getByText } = renderWith({
      ...baseDeposit,
      errorReason: DepositErrorReason.FeeExceeded,
      requiredFeeSats: 420,
    })

    expect(getByText("Network fee too high (need 420 sats)")).toBeTruthy()
  })

  it("falls back to 0 sats when requiredFeeSats is missing", () => {
    const { getByText } = renderWith({
      ...baseDeposit,
      errorReason: DepositErrorReason.FeeExceeded,
    })

    expect(getByText("Network fee too high (need 0 sats)")).toBeTruthy()
  })

  it("shows the below-dust warning", () => {
    const { getByText } = renderWith({
      ...baseDeposit,
      errorReason: DepositErrorReason.BelowDust,
    })

    expect(getByText("Deposit too small after fees")).toBeTruthy()
  })

  it("shows the missing-utxo error", () => {
    const { getByText } = renderWith({
      ...baseDeposit,
      errorReason: DepositErrorReason.MissingUtxo,
    })

    expect(getByText("Deposit no longer available on network")).toBeTruthy()
  })

  it("shows the generic error with the SDK-provided message when present", () => {
    const { getByText } = renderWith({
      ...baseDeposit,
      errorReason: DepositErrorReason.Generic,
      errorMessage: "sdk bang",
    })

    expect(getByText("Unable to claim: sdk bang")).toBeTruthy()
  })

  it("falls back to the default error copy when no SDK message is provided", () => {
    const { getByText } = renderWith({
      ...baseDeposit,
      errorReason: DepositErrorReason.Generic,
    })

    expect(getByText("Unable to claim: Unknown error")).toBeTruthy()
  })
})
