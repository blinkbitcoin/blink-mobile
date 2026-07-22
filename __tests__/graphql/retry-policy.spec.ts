import type { NetworkError } from "@apollo/client/errors"

import { shouldRetryOperation } from "@app/graphql/retry-policy"

/** A settled network failure with no HTTP status, as a lost response surfaces. */
const networkError = new Error("Network request failed") as NetworkError
/** An expired-token failure the dedicated 401 retry link owns instead. */
const unauthorizedError = { statusCode: 401 } as unknown as NetworkError

const RETRYABLE_OPERATION = "someRetryableQuery"
const NON_IDEMPOTENT_PAYMENT = "lnInvoicePaymentSend"

/**
 * The custodial-to-self-custodial migration mutations. Each commits state the backend
 * refuses to re-run, so a resend after a lost response must be suppressed.
 */
const MIGRATION_OPERATIONS = [
  "migrationStart",
  "migrationCommit",
  "migrationLnAddressTransfer",
]

describe("shouldRetryOperation", () => {
  it("does not retry when there is no error", () => {
    expect(shouldRetryOperation(null, RETRYABLE_OPERATION)).toBe(false)
  })

  it("retries a retryable operation that failed with a network error", () => {
    expect(shouldRetryOperation(networkError, RETRYABLE_OPERATION)).toBe(true)
  })

  it("does not retry a 401, whatever the operation", () => {
    expect(shouldRetryOperation(unauthorizedError, RETRYABLE_OPERATION)).toBe(false)
  })

  it("does not retry a non-idempotent payment send", () => {
    expect(shouldRetryOperation(networkError, NON_IDEMPOTENT_PAYMENT)).toBe(false)
  })

  describe("custodial-to-self-custodial migration mutations", () => {
    MIGRATION_OPERATIONS.forEach((operationName) => {
      it(`does not resend ${operationName} after a lost response`, () => {
        expect(shouldRetryOperation(networkError, operationName)).toBe(false)
      })
    })
  })
})
