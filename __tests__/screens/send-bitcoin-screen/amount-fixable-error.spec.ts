import { isAmountFixableError } from "@app/screens/send-bitcoin-screen/amount-fixable-error"
import { SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"

const amountErrors = [
  SelfCustodialErrorCode.InsufficientFunds,
  SelfCustodialErrorCode.BelowMinimum,
  "Payment amount '5000' sats exceeds balance '1000'",
  "No balance left to send.",
  "Cannot transfer more than $1000.00 in 24 hours",
  "Use lightning to send amounts less than 5000 sats",
  "Amount sent was too low for recipient's usd wallet.",
]

const otherErrors = [
  undefined,
  "",
  SelfCustodialErrorCode.NetworkError,
  SelfCustodialErrorCode.InvalidInput,
  SelfCustodialErrorCode.Generic,
  "route not found",
  "Unbalanced transaction: ledger entry rejected",
]

describe("isAmountFixableError", () => {
  amountErrors.forEach((raw) => {
    it(`is true for ${raw}`, () => {
      expect(isAmountFixableError(raw)).toBe(true)
    })
  })

  otherErrors.forEach((raw) => {
    it(`is false for ${JSON.stringify(raw)}`, () => {
      expect(isAmountFixableError(raw)).toBe(false)
    })
  })
})
