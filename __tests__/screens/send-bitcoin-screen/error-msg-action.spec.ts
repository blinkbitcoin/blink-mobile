import {
  ErrorMsgAction,
  errorMsgAction,
} from "@app/screens/send-bitcoin-screen/error-msg-action"
import { IDEMPOTENCY_KEY_UNAVAILABLE } from "@app/screens/send-bitcoin-screen/use-send-payment"
import { SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"

const base = { canSetAmount: true, isSelfCustodial: false, hasSent: true }

type Case = [
  name: string,
  overrides: Partial<Parameters<typeof errorMsgAction>[0]>,
  expected: ErrorMsgAction,
]

const cases: Case[] = [
  [
    "custodial amount message",
    { raw: "Cannot transfer more than $10 in 24 hours" },
    "changeAmount",
  ],
  ["custodial other failure", { raw: "Unable to find a route for payment." }, "tryAgain"],
  ["custodial thrown request", { raw: "network died" }, "tryAgain"],
  [
    "self-custodial amount code after a send",
    { raw: SelfCustodialErrorCode.InsufficientFunds, isSelfCustodial: true },
    "changeAmount",
  ],
  [
    "self-custodial amount code with a fixed amount",
    {
      raw: SelfCustodialErrorCode.BelowMinimum,
      isSelfCustodial: true,
      canSetAmount: false,
    },
    "tryAgain",
  ],
  [
    "self-custodial invalid input, nothing sent",
    { raw: SelfCustodialErrorCode.InvalidInput, isSelfCustodial: true },
    "tryAgain",
  ],
  [
    "self-custodial missing idempotency key, nothing sent",
    { raw: IDEMPOTENCY_KEY_UNAVAILABLE, isSelfCustodial: true },
    "tryAgain",
  ],
  [
    "self-custodial generic failure that may have landed",
    { raw: SelfCustodialErrorCode.Generic, isSelfCustodial: true },
    "home",
  ],
  [
    "self-custodial network failure that may have landed",
    { raw: SelfCustodialErrorCode.NetworkError, isSelfCustodial: true },
    "home",
  ],
  [
    "self-custodial thrown request",
    { raw: "network died", isSelfCustodial: true },
    "home",
  ],
  [
    "self-custodial generic failure before a send (fee quote)",
    { raw: SelfCustodialErrorCode.Generic, isSelfCustodial: true, hasSent: false },
    "tryAgain",
  ],
]

describe("errorMsgAction", () => {
  cases.forEach(([name, overrides, expected]) => {
    it(`${name} → ${expected}`, () => {
      expect(errorMsgAction({ raw: undefined, ...base, ...overrides })).toBe(expected)
    })
  })
})
