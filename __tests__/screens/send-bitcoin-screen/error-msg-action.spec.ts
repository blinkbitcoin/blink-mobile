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
  // On a send, these codes are the SDK's word that nothing went out, read partly from
  // its error text: not proof enough to build a new payment.
  [
    "self-custodial amount code on a send",
    { raw: SelfCustodialErrorCode.InsufficientFunds },
    "home",
  ],
  [
    "self-custodial amount code on a send with a fixed amount",
    { raw: SelfCustodialErrorCode.BelowMinimum, canSetAmount: false },
    "home",
  ],
  [
    "self-custodial invalid input on a send",
    { raw: SelfCustodialErrorCode.InvalidInput },
    "home",
  ],
  [
    "self-custodial amount code from a thrown send",
    { raw: SelfCustodialErrorCode.InsufficientFunds, outcome: "unconfirmed" },
    "home",
  ],
  [
    "amount code before a send with a fixed amount (fee quote)",
    { raw: SelfCustodialErrorCode.BelowMinimum, outcome: "notSent", canSetAmount: false },
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
