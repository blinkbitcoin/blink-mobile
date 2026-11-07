import { it } from "@jest/globals"
import { InMemoryCache } from "@apollo/client"
import { act, renderHook } from "@testing-library/react-native"

import {
  CardSpendingControlsDocument,
  CardSpendingControlsQuery,
  SpendingCategory,
  SpendingPeriod,
} from "@app/graphql/generated"
import { createCache } from "@app/graphql/cache"
import { useCardAtmControls } from "@app/screens/card-screen/card-limits-screen/hooks/use-card-atm-controls"

const mockUseControlsQuery = jest.fn()
const mockUseLimitSetMutation = jest.fn()
const mockUseLimitRemoveMutation = jest.fn()
const mockUseToggleSetMutation = jest.fn()
const mockLimitSet = jest.fn()
const mockLimitRemove = jest.fn()
const mockToggleSet = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useCardSpendingControlsQuery: (...args: readonly unknown[]) =>
    mockUseControlsQuery(...args),
  useCardSpendingLimitSetMutation: (...args: readonly unknown[]) =>
    mockUseLimitSetMutation(...args),
  useCardSpendingLimitRemoveMutation: (...args: readonly unknown[]) =>
    mockUseLimitRemoveMutation(...args),
  useCardSpendingToggleSetMutation: (...args: readonly unknown[]) =>
    mockUseToggleSetMutation(...args),
}))

const mockIsAuthed = jest.fn()
jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockIsAuthed(),
}))

jest.mock("@app/graphql/utils", () => ({
  getErrorMessages: (errors: ReadonlyArray<{ message: string }>) =>
    errors.map((e) => e.message).join(", "),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        CardLimits: {
          limitMustBePositive: () => "Limit must be greater than zero",
          limitUpdateSuccess: () => "Limit updated successfully",
          limitUpdateError: () => "Failed to update limit",
          atmToggleError: () => "Failed to update ATM withdrawals",
          invalidLimitAmount: () => "Enter a valid amount with up to 2 decimals",
        },
      },
    },
  }),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

type Limit = {
  __typename: "SpendingLimit"
  category: SpendingCategory
  period: SpendingPeriod
  limitCents: number
}
type Toggle = {
  __typename: "SpendingToggle"
  category: SpendingCategory
  enabled: boolean
}

const atmLimit = (period: SpendingPeriod, limitCents: number): Limit => ({
  __typename: "SpendingLimit",
  category: SpendingCategory.Atm,
  period,
  limitCents,
})

const atmToggle = (enabled: boolean): Toggle => ({
  __typename: "SpendingToggle",
  category: SpendingCategory.Atm,
  enabled,
})

const buildControls = ({
  cardId = "card-1",
  spendingLimits = [],
  spendingToggles = [],
}: {
  cardId?: string
  spendingLimits?: ReadonlyArray<Limit>
  spendingToggles?: ReadonlyArray<Toggle>
}): CardSpendingControlsQuery => ({
  __typename: "Query",
  me: {
    __typename: "User",
    id: "user-1",
    defaultAccount: {
      __typename: "ConsumerAccount",
      id: "account-1",
      cards: [{ __typename: "Card", id: cardId, spendingLimits, spendingToggles }],
    },
  },
})

const dailyLimit = atmLimit(SpendingPeriod.Daily, 20000)
const monthlyLimit = atmLimit(SpendingPeriod.Monthly, 100000)

const controlsWithLimits = buildControls({ spendingLimits: [dailyLimit, monthlyLimit] })
const controlsWithoutRules = buildControls({})
const controlsWithAtmDisabled = buildControls({ spendingToggles: [atmToggle(false)] })

const savedLimit = {
  data: { cardSpendingLimitSet: { limit: atmLimit(SpendingPeriod.Daily, 35050) } },
}
const removedLimit = { data: { cardSpendingLimitRemove: { removedLimit: monthlyLimit } } }
const savedToggle = { data: { cardSpendingToggleSet: { toggle: atmToggle(false) } } }

const deferred = <T>() => {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

const givenControls = (data: CardSpendingControlsQuery | undefined) =>
  mockUseControlsQuery.mockReturnValue({ data, loading: false })

const cacheWith = (data: CardSpendingControlsQuery) => {
  const cache = createCache()
  cache.writeQuery({ query: CardSpendingControlsDocument, data })
  return cache
}

const cachedCard = (cache: InMemoryCache) =>
  cache.readQuery<CardSpendingControlsQuery>({ query: CardSpendingControlsDocument })?.me
    ?.defaultAccount?.cards?.[0]

const cacheUpdateOf = (useMutation: jest.Mock) => useMutation.mock.calls[0][0].update

describe("useCardAtmControls", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAuthed.mockReturnValue(true)
    givenControls(controlsWithLimits)
    mockUseLimitSetMutation.mockReturnValue([mockLimitSet])
    mockUseLimitRemoveMutation.mockReturnValue([mockLimitRemove])
    mockUseToggleSetMutation.mockReturnValue([mockToggleSet])
    mockLimitSet.mockResolvedValue(savedLimit)
    mockLimitRemove.mockResolvedValue(removedLimit)
    mockToggleSet.mockResolvedValue(savedToggle)
  })

  describe("reading the controls", () => {
    it("asks for the controls only with a session", () => {
      mockIsAuthed.mockReturnValue(false)
      renderHook(() => useCardAtmControls("card-1"))
      expect(mockUseControlsQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ skip: true }),
      )

      mockIsAuthed.mockReturnValue(true)
      renderHook(() => useCardAtmControls(""))
      expect(mockUseControlsQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ skip: false, fetchPolicy: "network-only" }),
      )
    })

    it("reads the card's daily and monthly ATM limits", () => {
      const { result } = renderHook(() => useCardAtmControls("card-1"))

      expect(result.current.atmDailyLimitCents).toBe(20000)
      expect(result.current.atmMonthlyLimitCents).toBe(100000)
      expect(result.current.hasAtmControls).toBe(true)
    })

    it("treats a card with no ATM rules as unlimited and allowed", () => {
      givenControls(controlsWithoutRules)

      const { result } = renderHook(() => useCardAtmControls("card-1"))

      expect(result.current.atmDailyLimitCents).toBeNull()
      expect(result.current.atmMonthlyLimitCents).toBeNull()
      expect(result.current.isAtmEnabled).toBe(true)
    })

    it("reads ATM withdrawals as off when the card turned them off", () => {
      givenControls(controlsWithAtmDisabled)

      const { result } = renderHook(() => useCardAtmControls("card-1"))

      expect(result.current.isAtmEnabled).toBe(false)
    })

    it("has no controls for a card the account does not hold", () => {
      givenControls(
        buildControls({ cardId: "card-2", spendingToggles: [atmToggle(false)] }),
      )

      const { result } = renderHook(() => useCardAtmControls("card-1"))

      expect(result.current.hasAtmControls).toBe(false)
      expect(result.current.isAtmEnabled).toBe(true)
    })

    it("has no controls before they arrive", () => {
      mockUseControlsQuery.mockReturnValue({ data: undefined, loading: true })

      const { result } = renderHook(() => useCardAtmControls("card-1"))

      expect(result.current.loading).toBe(true)
      expect(result.current.hasAtmControls).toBe(false)
    })
  })

  describe("writing answers into the cached card", () => {
    it("puts a saved limit in place of the one for that period", () => {
      const cache = cacheWith(controlsWithLimits)
      renderHook(() => useCardAtmControls("card-1"))

      cacheUpdateOf(mockUseLimitSetMutation)(cache, savedLimit)

      expect(cachedCard(cache)?.spendingLimits).toEqual([
        monthlyLimit,
        atmLimit(SpendingPeriod.Daily, 35050),
      ])
    })

    it("drops a lifted limit and keeps the other one", () => {
      const cache = cacheWith(controlsWithLimits)
      renderHook(() => useCardAtmControls("card-1"))

      cacheUpdateOf(mockUseLimitRemoveMutation)(cache, removedLimit)

      expect(cachedCard(cache)?.spendingLimits).toEqual([dailyLimit])
    })

    it("puts a saved switch in place of the previous one", () => {
      const cache = cacheWith(controlsWithAtmDisabled)
      renderHook(() => useCardAtmControls("card-1"))

      cacheUpdateOf(mockUseToggleSetMutation)(cache, {
        data: { cardSpendingToggleSet: { toggle: atmToggle(true) } },
      })

      expect(cachedCard(cache)?.spendingToggles).toEqual([atmToggle(true)])
    })

    it("leaves the cache alone when the answer carries no control", () => {
      const cache = cacheWith(controlsWithLimits)
      renderHook(() => useCardAtmControls("card-1"))

      cacheUpdateOf(mockUseLimitSetMutation)(cache, { data: null })
      cacheUpdateOf(mockUseLimitRemoveMutation)(cache, { data: null })
      cacheUpdateOf(mockUseToggleSetMutation)(cache, { data: null })

      expect(cachedCard(cache)?.spendingLimits).toEqual([dailyLimit, monthlyLimit])
      expect(cachedCard(cache)?.spendingToggles).toEqual([])
    })

    it("writes nothing when the card is not cached", () => {
      const cache = createCache()
      renderHook(() => useCardAtmControls("card-1"))

      cacheUpdateOf(mockUseLimitSetMutation)(cache, savedLimit)

      expect(cache.extract()).toEqual({})
    })
  })

  describe("ATM limits", () => {
    it("saves a new daily limit in cents and confirms it", async () => {
      const { result } = renderHook(() => useCardAtmControls("card-1"))

      await act(async () => {
        await result.current.handleUpdateAtmDailyLimit("350.5")
      })

      expect(mockLimitSet).toHaveBeenCalledWith({
        variables: {
          input: {
            cardId: "card-1",
            category: SpendingCategory.Atm,
            period: SpendingPeriod.Daily,
            limitCents: 35050,
          },
        },
      })
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Limit updated successfully",
          type: "success",
        }),
      )
    })

    it("saves a new monthly limit for the monthly period", async () => {
      const { result } = renderHook(() => useCardAtmControls("card-1"))

      await act(async () => {
        await result.current.handleUpdateAtmMonthlyLimit("2000")
      })

      expect(mockLimitSet).toHaveBeenCalledWith({
        variables: {
          input: expect.objectContaining({
            period: SpendingPeriod.Monthly,
            limitCents: 200000,
          }),
        },
      })
    })

    it("lifts the limit when its field is emptied", async () => {
      const { result } = renderHook(() => useCardAtmControls("card-1"))

      await act(async () => {
        await result.current.handleUpdateAtmMonthlyLimit("  ")
      })

      expect(mockLimitRemove).toHaveBeenCalledWith({
        variables: {
          input: {
            cardId: "card-1",
            category: SpendingCategory.Atm,
            period: SpendingPeriod.Monthly,
          },
        },
      })
      expect(mockLimitSet).not.toHaveBeenCalled()
    })

    it("leaves an empty field alone when there was no limit to lift", async () => {
      givenControls(controlsWithoutRules)
      const { result } = renderHook(() => useCardAtmControls("card-1"))

      await act(async () => {
        await result.current.handleUpdateAtmDailyLimit("")
      })

      expect(mockLimitRemove).not.toHaveBeenCalled()
      expect(mockToastShow).not.toHaveBeenCalled()
    })

    it("leaves an unchanged amount alone", async () => {
      const { result } = renderHook(() => useCardAtmControls("card-1"))

      await act(async () => {
        await result.current.handleUpdateAtmDailyLimit("200")
      })

      expect(mockLimitSet).not.toHaveBeenCalled()
      expect(mockToastShow).not.toHaveBeenCalled()
    })

    it.each(["0", "0.00"])("refuses %s as a limit", async (dollars) => {
      const { result } = renderHook(() => useCardAtmControls("card-1"))

      await act(async () => {
        await result.current.handleUpdateAtmDailyLimit(dollars)
      })

      expect(mockLimitSet).not.toHaveBeenCalled()
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Limit must be greater than zero" }),
      )
    })

    it.each([
      ["a numeric prefix", "100abc"],
      ["letters", "abc"],
      ["a sign", "-20"],
      ["a repeated separator", "100..50"],
      ["more than two decimals", "100.505"],
      ["an amount beyond what the API takes", "21474836.48"],
    ])("saves nothing for %s and says why", async (_case, dollars) => {
      const { result } = renderHook(() => useCardAtmControls("card-1"))

      await act(async () => {
        await result.current.handleUpdateAtmDailyLimit(dollars)
      })

      expect(mockLimitSet).not.toHaveBeenCalled()
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Enter a valid amount with up to 2 decimals",
        }),
      )
    })

    it("takes a comma as the decimal separator", async () => {
      const { result } = renderHook(() => useCardAtmControls("card-1"))

      await act(async () => {
        await result.current.handleUpdateAtmDailyLimit("350,50")
      })

      expect(mockLimitSet).toHaveBeenCalledWith({
        variables: {
          input: expect.objectContaining({ limitCents: 35050 }),
        },
      })
    })

    it("marks the period as saving until the server answers", async () => {
      const pendingSave = deferred<typeof savedLimit>()
      mockLimitSet.mockReturnValue(pendingSave.promise)
      const { result } = renderHook(() => useCardAtmControls("card-1"))

      act(() => {
        result.current.handleUpdateAtmMonthlyLimit("1500")
      })

      expect(result.current.updatingAtmLimit).toBe(SpendingPeriod.Monthly)

      await act(async () => {
        pendingSave.resolve(savedLimit)
      })

      expect(result.current.updatingAtmLimit).toBeNull()
    })

    it("shows the server's errors and skips the confirmation", async () => {
      mockLimitSet.mockResolvedValue({
        data: null,
        errors: [{ message: "Card not found" }, { message: "Try again" }],
      })
      const { result } = renderHook(() => useCardAtmControls("card-1"))

      await act(async () => {
        await result.current.handleUpdateAtmDailyLimit("300")
      })

      expect(mockToastShow).toHaveBeenCalledTimes(1)
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Card not found, Try again" }),
      )
      expect(result.current.updatingAtmLimit).toBeNull()
    })

    it("reports a failed update when the server sends nothing back", async () => {
      mockLimitRemove.mockResolvedValue({ data: null })
      const { result } = renderHook(() => useCardAtmControls("card-1"))

      await act(async () => {
        await result.current.handleUpdateAtmDailyLimit("")
      })

      expect(mockToastShow).toHaveBeenCalledTimes(1)
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to update limit" }),
      )
    })

    it("shows the network error when the request fails", async () => {
      mockLimitSet.mockRejectedValue(new Error("Network failure"))
      const { result } = renderHook(() => useCardAtmControls("card-1"))

      await act(async () => {
        await result.current.handleUpdateAtmDailyLimit("300")
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Network failure" }),
      )
      expect(result.current.updatingAtmLimit).toBeNull()
    })

    it("falls back to a generic message for a failure without one", async () => {
      mockLimitSet.mockRejectedValue("offline")
      const { result } = renderHook(() => useCardAtmControls("card-1"))

      await act(async () => {
        await result.current.handleUpdateAtmDailyLimit("300")
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to update limit" }),
      )
    })
  })

  describe("ATM withdrawals switch", () => {
    it("turns ATM withdrawals off without a confirmation toast", async () => {
      const { result } = renderHook(() => useCardAtmControls("card-1"))

      await act(async () => {
        await result.current.handleToggleAtm(false)
      })

      expect(mockToggleSet).toHaveBeenCalledWith({
        variables: {
          input: { cardId: "card-1", category: SpendingCategory.Atm, enabled: false },
        },
      })
      expect(mockToastShow).not.toHaveBeenCalled()
    })

    it("holds the requested value while saving and keeps it once saved", async () => {
      const pendingSave = deferred<typeof savedToggle>()
      mockToggleSet.mockReturnValue(pendingSave.promise)
      const { result, rerender } = renderHook(() => useCardAtmControls("card-1"))

      act(() => {
        result.current.handleToggleAtm(false)
      })

      expect(result.current.isAtmEnabled).toBe(false)
      expect(result.current.isTogglingAtm).toBe(true)

      givenControls(controlsWithAtmDisabled)
      rerender({})
      await act(async () => {
        pendingSave.resolve(savedToggle)
      })

      expect(result.current.isAtmEnabled).toBe(false)
      expect(result.current.isTogglingAtm).toBe(false)
    })

    it("goes back to the saved value when saving fails", async () => {
      mockToggleSet.mockRejectedValue(new Error("Network failure"))
      const { result } = renderHook(() => useCardAtmControls("card-1"))

      await act(async () => {
        await result.current.handleToggleAtm(false)
      })

      expect(result.current.isAtmEnabled).toBe(true)
      expect(result.current.isTogglingAtm).toBe(false)
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Network failure" }),
      )
    })

    it("reports a failed switch when the server sends nothing back", async () => {
      mockToggleSet.mockResolvedValue({ data: null })
      const { result } = renderHook(() => useCardAtmControls("card-1"))

      await act(async () => {
        await result.current.handleToggleAtm(false)
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to update ATM withdrawals" }),
      )
      expect(result.current.isAtmEnabled).toBe(true)
    })
  })
})
