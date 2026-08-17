import { ApolloLink, execute, Observable, gql } from "@apollo/client"
import type { NetworkError } from "@apollo/client/errors"

import { createUnauthorizedRetryLink } from "@app/graphql/retry-policy"

/**
 * The predicates are unit-tested in retry-policy.spec.ts; this exercises the link that
 * composes them, because dropping the composition would leave those unit tests green
 * while silently re-enabling 401 resends on the irreversible operations.
 */
const unauthorized = { statusCode: 401 } as unknown as NetworkError

const ACCOUNT_DELETE = gql`
  mutation accountDelete {
    accountDelete {
      success
    }
  }
`

const RETRYABLE_QUERY = gql`
  query someRetryableQuery {
    me {
      id
    }
  }
`

const RETRY_DELAY_MS = 5000

/** The link resolves its retry through promises, so the clock alone does not settle it. */
const flush = () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve)
  })

/** Counts attempts and fails every one with a 401, so the link decides how many arrive. */
const failingServer = (attempts: { count: number }) =>
  new ApolloLink(
    () =>
      new Observable((observer) => {
        attempts.count += 1
        observer.error(unauthorized)
      }),
  )

const run = (document: typeof ACCOUNT_DELETE) => {
  const attempts = { count: 0 }
  const link = ApolloLink.from([createUnauthorizedRetryLink(), failingServer(attempts)])

  execute(link, { query: document }).subscribe({
    error: () => {},
  })

  return attempts
}

describe("the unauthorized retry link", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["setImmediate"] })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("sends accountDelete exactly once, however long the retry window stays open", async () => {
    const attempts = run(ACCOUNT_DELETE)
    await flush()

    jest.advanceTimersByTime(RETRY_DELAY_MS * 4)
    await flush()

    expect(attempts.count).toBe(1)
  })

  /** The control: without it, a link that never retries anything would pass the case above. */
  it("still retries an operation that is safe to resend", async () => {
    const attempts = run(RETRYABLE_QUERY)
    await flush()
    expect(attempts.count).toBe(1)

    jest.advanceTimersByTime(RETRY_DELAY_MS)
    await flush()

    expect(attempts.count).toBe(2)
  })
})
