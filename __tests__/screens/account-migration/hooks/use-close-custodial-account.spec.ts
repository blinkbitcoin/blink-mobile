import { ApolloError } from "@apollo/client"
import { renderHook } from "@testing-library/react-native"

import {
  AccountCloseOutcome,
  useCloseCustodialAccount,
} from "@app/screens/account-migration/hooks/use-close-custodial-account"

const mockDeleteAccount = jest.fn()
const mockReportError = jest.fn()
const mockUseAccountDeleteMutation = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useAccountDeleteMutation: (options: unknown) => {
    mockUseAccountDeleteMutation(options)
    return [mockDeleteAccount]
  },
}))

jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (operation: string, err: unknown) => mockReportError(operation, err),
}))

type Rejection = { message: string; code?: string | null }

const payload = (accountDelete: { success: boolean; errors: Rejection[] } | null) => ({
  data: { accountDelete },
})

const networkError = () =>
  Object.assign(new Error("offline"), { networkError: new Error("net") })

const close = async (
  custodialAccountId: string | null = "custodial-1",
): Promise<AccountCloseOutcome> => {
  const { result } = renderHook(() => useCloseCustodialAccount())
  return result.current.closeCustodialAccount(custodialAccountId)
}

describe("useCloseCustodialAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDeleteAccount.mockResolvedValue(payload({ success: true, errors: [] }))
  })

  /** A cached read would answer for a session the server may have already killed. */
  it("reads the deletion straight from the server", async () => {
    await close()

    expect(mockUseAccountDeleteMutation).toHaveBeenCalledWith({
      fetchPolicy: "no-cache",
    })
  })

  it("reports the account closed when the deletion succeeds", async () => {
    expect(await close()).toBe(AccountCloseOutcome.Closed)

    expect(mockDeleteAccount).toHaveBeenCalledTimes(1)
    expect(mockReportError).not.toHaveBeenCalled()
  })

  /** Mid-drain the balance reads zero with the payment pending, so the server refuses. The
   *  token outlives the refusal, so the caller can spend it on a later attempt. */
  it("stays retryable while a transfer is still in flight", async () => {
    mockDeleteAccount.mockResolvedValue(
      payload({
        success: false,
        errors: [{ message: "transfer in flight", code: "MIGRATION_STATE_CONFLICT" }],
      }),
    )

    expect(await close()).toBe(AccountCloseOutcome.Retryable)
  })

  it("does not report the transfer-in-flight refusal", async () => {
    mockDeleteAccount.mockResolvedValue(
      payload({
        success: false,
        errors: [{ message: "transfer in flight", code: "MIGRATION_STATE_CONFLICT" }],
      }),
    )
    await close()

    expect(mockReportError).not.toHaveBeenCalled()
  })

  /** The phone-deletion cap. No retry ever clears it, so support takes over. */
  it("refuses for good when the deletion cap is hit", async () => {
    mockDeleteAccount.mockResolvedValue(
      payload({
        success: false,
        errors: [
          { message: "reach out to our support team", code: "OPERATION_RESTRICTED" },
        ],
      }),
    )

    expect(await close()).toBe(AccountCloseOutcome.Refused)
  })

  /** The server's own explanation is the only thing that tells on-call the cap fired
   *  rather than some other restricted-operation refusal, so it is kept under its own name. */
  it("reports the deletion cap under its own name, with the server's message", async () => {
    mockDeleteAccount.mockResolvedValue(
      payload({
        success: false,
        errors: [
          { message: "reach out to our support team", code: "OPERATION_RESTRICTED" },
        ],
      }),
    )
    await close()

    expect(mockReportError).toHaveBeenCalledWith(
      "Migration account close capped",
      expect.objectContaining({
        message: "reach out to our support team (accountId: custodial-1)",
      }),
    )
  })

  it("refuses and reports a rejection it does not recognise", async () => {
    mockDeleteAccount.mockResolvedValue(
      payload({
        success: false,
        errors: [{ message: "account is inactive", code: "INACTIVE_ACCOUNT" }],
      }),
    )

    expect(await close()).toBe(AccountCloseOutcome.Refused)
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration account close rejected",
      expect.objectContaining({
        message: "account is inactive (accountId: custodial-1)",
      }),
    )
  })

  /** The report is the only trace of the leftover account, so it still goes out when the
   *  owner query has not resolved: a named placeholder beats a silent one. */
  it("names the missing id rather than dropping the report", async () => {
    mockDeleteAccount.mockResolvedValue(
      payload({
        success: false,
        errors: [{ message: "capped", code: "OPERATION_RESTRICTED" }],
      }),
    )
    await close(null)

    expect(mockReportError).toHaveBeenCalledWith(
      "Migration account close capped",
      expect.objectContaining({ message: "capped (accountId: unknown)" }),
    )
  })

  it("refuses and reports a rejection that carries no code", async () => {
    mockDeleteAccount.mockResolvedValue(
      payload({ success: false, errors: [{ message: "something broke" }] }),
    )

    expect(await close()).toBe(AccountCloseOutcome.Refused)
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration account close rejected",
      expect.objectContaining({ message: "something broke (accountId: custodial-1)" }),
    )
  })

  /** The answer never arrived, so it earns a retry rather than burning the one window the
   *  close has on the strength of no answer. Same call the migration-start sibling makes. */
  it("stays retryable and reports when the payload says nothing", async () => {
    mockDeleteAccount.mockResolvedValue(payload({ success: false, errors: [] }))

    expect(await close()).toBe(AccountCloseOutcome.Retryable)
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration account close empty payload",
      expect.any(Error),
    )
  })

  it("stays retryable when the mutation returns no payload at all", async () => {
    mockDeleteAccount.mockResolvedValue(payload(null))

    expect(await close()).toBe(AccountCloseOutcome.Retryable)
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration account close empty payload",
      expect.any(Error),
    )
  })

  /** A mutation the network never delivered can still land, so support never hears about it. */
  it("stays retryable and silent when the network drops the mutation", async () => {
    mockDeleteAccount.mockRejectedValue(networkError())

    expect(await close()).toBe(AccountCloseOutcome.Retryable)
    expect(mockReportError).not.toHaveBeenCalled()
  })

  /** The deletion landed and only its answer was lost. No later call can authenticate
   *  either, so calling this retryable would 401 forever and strand the migration. */
  it("counts a 401 as closed, because the token it used is already dead", async () => {
    mockDeleteAccount.mockRejectedValue(
      new ApolloError({
        networkError: Object.assign(new Error("401"), { statusCode: 401 }),
      }),
    )

    expect(await close()).toBe(AccountCloseOutcome.Closed)
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration account close unacknowledged",
      expect.any(Error),
    )
  })

  it("counts a bare 401 server error as closed too", async () => {
    mockDeleteAccount.mockRejectedValue(
      Object.assign(new Error("Unauthorized"), { statusCode: 401 }),
    )

    expect(await close()).toBe(AccountCloseOutcome.Closed)
  })

  /** Only a dead token is conclusive: another status is still a plain network failure. */
  it("keeps a 500 retryable rather than assuming the account is gone", async () => {
    mockDeleteAccount.mockRejectedValue(
      new ApolloError({
        networkError: Object.assign(new Error("500"), { statusCode: 500 }),
      }),
    )

    expect(await close()).toBe(AccountCloseOutcome.Retryable)
  })

  /** A conflict behind another error is still a conflict: misreading it as terminal would
   *  spend the one window the close has on a refusal that clears by itself. */
  it("finds the transfer-in-flight refusal behind another error", async () => {
    mockDeleteAccount.mockResolvedValue(
      payload({
        success: false,
        errors: [
          { message: "validation", code: "VALIDATION_ERROR" },
          { message: "transfer in flight", code: "MIGRATION_STATE_CONFLICT" },
        ],
      }),
    )

    expect(await close()).toBe(AccountCloseOutcome.Retryable)
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it("refuses and reports a throw that is not a network failure", async () => {
    const thrown = new Error("apollo blew up")
    mockDeleteAccount.mockRejectedValue(thrown)

    expect(await close()).toBe(AccountCloseOutcome.Refused)
    expect(mockReportError).toHaveBeenCalledWith("Migration account close failed", thrown)
  })
})
