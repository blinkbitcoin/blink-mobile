import React, { PropsWithChildren } from "react"
import { act, renderHook, waitFor } from "@testing-library/react-native"

import { InMemoryCache } from "@apollo/client"
import { MockedProvider, MockedResponse } from "@apollo/client/testing"
import {
  AccountLevel,
  AccountLimitsByLevelDocument,
  AccountLimitsByLevelQuery,
} from "@app/graphql/generated"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import {
  FALLBACK_LEVEL1_DAILY_LIMIT_CENTS,
  useLevel1DailyLimit,
} from "@app/hooks/use-level1-daily-limit"

loadLocale("en")

type LevelRow = { level: string; withdrawal: number }

const limitsMock = (rows: LevelRow[]): MockedResponse => ({
  request: { query: AccountLimitsByLevelDocument },
  result: {
    data: {
      globals: {
        __typename: "Globals",
        accountLimitsByLevel: rows.map((row) => ({
          __typename: "AccountLevelLimits",
          ...row,
        })),
      },
    },
  },
})

// The locale must be pinned, not inherited: without a provider the hook formats
// with the host machine's ICU default, so these assertions pass under en-US CI
// and fail on, e.g., a de-DE or en-ZA developer machine.
const wrapper = (mocks: ReadonlyArray<MockedResponse>, cache?: InMemoryCache) => {
  const Wrapper: React.FC<PropsWithChildren> = ({ children }) => (
    <MockedProvider mocks={mocks} cache={cache}>
      <TypesafeI18n locale="en">{children}</TypesafeI18n>
    </MockedProvider>
  )
  return Wrapper
}

describe("useLevel1DailyLimit", () => {
  it("returns the level ONE withdrawal limit from a multi-level response", async () => {
    const { result } = renderHook(() => useLevel1DailyLimit(), {
      wrapper: wrapper([
        limitsMock([
          { level: "ZERO", withdrawal: 25000 },
          { level: "ONE", withdrawal: 150000 },
          { level: "TWO", withdrawal: 500000 },
        ]),
      ]),
    })

    await waitFor(() => expect(result.current.limit).toBe("1,500"))
  })

  it("falls back when the response has no level ONE entry", async () => {
    const { result } = renderHook(() => useLevel1DailyLimit(), {
      wrapper: wrapper([limitsMock([{ level: "ZERO", withdrawal: 25000 }])]),
    })

    // let the query resolve, then confirm the fallback is still shown
    await act(
      async () =>
        new Promise((resolve) => {
          setTimeout(resolve, 0)
        }),
    )
    expect(result.current.limit).toBe("999")
  })

  it("falls back to the audited value while loading and after a query error", async () => {
    const errorMock: MockedResponse = {
      request: { query: AccountLimitsByLevelDocument },
      error: new Error("cannot query field 'accountLimitsByLevel' on type 'Globals'"),
    }
    const { result } = renderHook(() => useLevel1DailyLimit(), {
      wrapper: wrapper([errorMock]),
    })

    // first render: query in flight, fallback already correct
    expect(result.current.limit).toBe("999")
    expect(FALLBACK_LEVEL1_DAILY_LIMIT_CENTS).toBe(99900)

    // after the error lands, the fallback must still be shown
    await act(
      async () =>
        new Promise((resolve) => {
          setTimeout(resolve, 0)
        }),
    )
    expect(result.current.limit).toBe("999")
  })

  it("keeps fractional cents readable instead of truncating them", async () => {
    const { result } = renderHook(() => useLevel1DailyLimit(), {
      wrapper: wrapper([limitsMock([{ level: "ONE", withdrawal: 99950 }])]),
    })

    await waitFor(() => expect(result.current.limit).toBe("999.5"))
  })

  it("refreshes a stale cached value from the network", async () => {
    // The app's Apollo cache is persisted to AsyncStorage, so this stands in
    // for a relaunch after ops changed the limit: the persisted value renders
    // first, and cache-and-network must then correct it. Three distinct
    // amounts, so each assertion has exactly one possible source — 250000 is
    // neither the fallback nor the served value, so the first assertion fails
    // if the cache is not read, and the second fails under cache-first.
    const staleCache = new InMemoryCache()
    staleCache.writeQuery<AccountLimitsByLevelQuery>({
      query: AccountLimitsByLevelDocument,
      data: {
        __typename: "Query",
        globals: {
          __typename: "Globals",
          accountLimitsByLevel: [
            {
              __typename: "AccountLevelLimits",
              level: AccountLevel.One,
              withdrawal: 250000,
            },
          ],
        },
      },
    })

    const { result } = renderHook(() => useLevel1DailyLimit(), {
      wrapper: wrapper([limitsMock([{ level: "ONE", withdrawal: 150000 }])], staleCache),
    })

    // the persisted value renders immediately — no loading flash of the
    // fallback, which would read "999"
    expect(result.current.limit).toBe("2,500")

    await waitFor(() => expect(result.current.limit).toBe("1,500"))
  })
})
