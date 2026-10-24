import {
  ErrorMsgAction,
  errorMsgAction,
} from "@app/screens/send-bitcoin-screen/error-msg-action"
import { IDEMPOTENCY_KEY_UNAVAILABLE } from "@app/screens/send-bitcoin-screen/use-send-payment"
import { SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"

const base = { canSetAmount: true, outcome: "failed" } as const

type Case = [
  name: string,
  overrides: Partial<Parameters<typeof errorMsgAction>[0]>,
  expected: ErrorMsgAction,
]

// Change amount and Try again both build a new payment: after anything that may have
// sent, the only way out is Home.
const cases: Case[] = [
  [
    "custodial amount message, which server text can't vouch for",
    { raw: "Cannot transfer more than $10 in 24 hours" },
    "home",
  ],
  ["custodial other failure", { raw: "Unable to find a route for payment." }, "home"],
  ["custodial failure with no reason", { raw: undefined }, "home"],
  ["custodial thrown request", { raw: "network died", outcome: "unconfirmed" }, "home"],
  [
    "throw before a key existed, nothing sent",
    { raw: IDEMPOTENCY_KEY_UNAVAILABLE, outcome: "unconfirmed" },
    "tryAgain",
  ],
  [
    "self-custodial amount code raised before the send",
    { raw: SelfCustodialErrorCode.InsufficientFunds },
    "changeAmount",
  ],
  [
    "self-custodial amount code with a fixed amount",
    { raw: SelfCustodialErrorCode.BelowMinimum, canSetAmount: false },
    "tryAgain",
  ],
  [
    "self-custodial invalid input, nothing sent",
    { raw: SelfCustodialErrorCode.InvalidInput },
    "tryAgain",
  ],
  [
    "self-custodial generic failure that may have landed",
    { raw: SelfCustodialErrorCode.Generic },
    "home",
  ],
  [
    "self-custodial network failure that may have landed",
    { raw: SelfCustodialErrorCode.NetworkError },
    "home",
  ],
  [
    "self-custodial generic failure before a send (fee quote)",
    { raw: SelfCustodialErrorCode.Generic, outcome: "notSent" },
    "tryAgain",
  ],
  [
    "amount code before a send (fee quote)",
    { raw: SelfCustodialErrorCode.BelowMinimum, outcome: "notSent" },
    "changeAmount",
  ],
]

describe("errorMsgAction", () => {
  cases.forEach(([name, overrides, expected]) => {
    it(`${name} → ${expected}`, () => {
      expect(errorMsgAction({ raw: undefined, ...base, ...overrides })).toBe(expected)
    })
  })
})
