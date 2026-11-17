import { useCallback, useRef, useState } from "react"
import { ApolloCache, FetchResult, NormalizedCacheObject, gql } from "@apollo/client"

import {
  CardSpendingControlsFragment,
  CardSpendingControlsFragmentDoc,
  SpendingCategory,
  SpendingPeriod,
  useCardSpendingControlsQuery,
  useCardSpendingLimitRemoveMutation,
  useCardSpendingLimitSetMutation,
  useCardSpendingToggleSetMutation,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { isNetworkFailure } from "@app/graphql/transport-error"
import { getErrorMessages } from "@app/graphql/utils"
import { useI18nContext } from "@app/i18n/i18n-react"
import { parseDollarsToCents } from "@app/utils/helper"
import { toastShow } from "@app/utils/toast"
import { withTimeout } from "@app/utils/with-timeout"

gql`
  fragment CardSpendingControls on Card {
    id
    spendingLimits {
      category
      period
      limitCents
    }
    spendingToggles {
      category
      enabled
    }
  }

  query cardSpendingControls {
    me {
      id
      defaultAccount {
        id
        ... on ConsumerAccount {
          cards {
            ...CardSpendingControls
          }
        }
      }
    }
  }

  mutation cardSpendingLimitSet($input: CardSpendingLimitSetInput!) {
    cardSpendingLimitSet(input: $input) {
      limit {
        category
        period
        limitCents
      }
    }
  }

  mutation cardSpendingLimitRemove($input: CardSpendingLimitRemoveInput!) {
    cardSpendingLimitRemove(input: $input) {
      removedLimit {
        category
        period
        limitCents
      }
    }
  }

  mutation cardSpendingToggleSet($input: CardSpendingToggleSetInput!) {
    cardSpendingToggleSet(input: $input) {
      toggle {
        category
        enabled
      }
    }
  }
`

type CardControls = CardSpendingControlsFragment
type CardLimit = CardControls["spendingLimits"][number]
type CardToggle = CardControls["spendingToggles"][number]

const isSameLimitSlot = (entry: CardLimit, limit: CardLimit) =>
  entry.category === limit.category && entry.period === limit.period

const withLimit = (limit: CardLimit) => (card: CardControls) => ({
  ...card,
  spendingLimits: [
    ...card.spendingLimits.filter((entry) => !isSameLimitSlot(entry, limit)),
    limit,
  ],
})

const withoutLimit = (limit: CardLimit) => (card: CardControls) => ({
  ...card,
  spendingLimits: card.spendingLimits.filter((entry) => !isSameLimitSlot(entry, limit)),
})

const withToggle = (toggle: CardToggle) => (card: CardControls) => ({
  ...card,
  spendingToggles: [
    ...card.spendingToggles.filter(({ category }) => category !== toggle.category),
    toggle,
  ],
})

/** The mutations answer with the saved control alone, not the card, so each answer
 *  is written into the cached card and the screen reads it back from there. */
const updateCachedCard = (
  cache: ApolloCache<NormalizedCacheObject>,
  cardId: string,
  update: (card: CardControls) => CardControls,
) =>
  cache.updateFragment<CardControls>(
    {
      id: cache.identify({ __typename: "Card", id: cardId }),
      fragment: CardSpendingControlsFragmentDoc,
    },
    (card) => (card ? update(card) : card),
  )

/** A read of the controls has no deadline of its own, so one stalled on a broken
 *  connection would hold the section on its loader for good. The bound leaves room for the
 *  transport's own retries of a query that fails on the network. */
const CONTROLS_READ_TIMEOUT_MS = 20_000

/** Where a read of the controls the hook asked for itself stands: after a save that got
 *  no answer, or from the retry. "settled" means no such read is out or failed. */
type ControlsRead = "settled" | "reading" | "failed"

const findAtmLimitCents = (
  limits: ReadonlyArray<CardLimit> | undefined,
  period: SpendingPeriod,
): number | null =>
  limits?.find(
    (limit) => limit.category === SpendingCategory.Atm && limit.period === period,
  )?.limitCents ?? null

export const useCardAtmControls = (cardId: string) => {
  const isAuthed = useIsAuthed()
  const { LL } = useI18nContext()
  const [updatingAtmLimit, setUpdatingAtmLimit] = useState<SpendingPeriod | null>(null)
  const [pendingAtmEnabled, setPendingAtmEnabled] = useState<boolean | null>(null)
  const [controlsRead, setControlsRead] = useState<ControlsRead>("settled")
  /** Mirrors `controlsRead` the moment it changes, so a save tapped in the same frame as
   *  the failure that held the controls back is refused too, before any render. */
  const controlsReadRef = useRef<ControlsRead>("settled")
  const latestReadRef = useRef(0)
  const markControlsRead = useCallback((state: ControlsRead) => {
    controlsReadRef.current = state
    setControlsRead(state)
  }, [])

  /** notifyOnNetworkStatusChange reopens `loading` for a retry, so the section shows it
   *  running instead of leaving the failure on screen until the answer. */
  const { data, loading, refetch } = useCardSpendingControlsQuery({
    skip: !isAuthed,
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  })
  const [cardSpendingLimitSet] = useCardSpendingLimitSetMutation({
    update: (cache, { data: result }) => {
      const limit = result?.cardSpendingLimitSet.limit
      if (limit) updateCachedCard(cache, cardId, withLimit(limit))
    },
  })
  const [cardSpendingLimitRemove] = useCardSpendingLimitRemoveMutation({
    update: (cache, { data: result }) => {
      const limit = result?.cardSpendingLimitRemove.removedLimit
      if (limit) updateCachedCard(cache, cardId, withoutLimit(limit))
    },
  })
  const [cardSpendingToggleSet] = useCardSpendingToggleSetMutation({
    update: (cache, { data: result }) => {
      const toggle = result?.cardSpendingToggleSet.toggle
      if (toggle) updateCachedCard(cache, cardId, withToggle(toggle))
    },
  })

  const card = data?.me?.defaultAccount?.cards?.find(({ id }) => id === cardId)
  /** The values below, the unlimited and allowed defaults included, only mean something
   *  once an answer holds the card. A failed request, or one that answered without the
   *  card, is a failure the screen offers to retry, never a card with no ATM rules. While
   *  a read the hook asked for is out or failed, the card it holds may no longer be what
   *  the server has, so the controls are held back the same way. */
  const hasCard = card !== undefined
  const isControlsReadSettled = controlsRead === "settled"
  const isControlsReadOut = controlsRead === "reading"
  const hasControlsReadFailed = controlsRead === "failed"
  const hasAtmControls = hasCard && isControlsReadSettled
  const isInitialReadLoading = loading && !hasCard
  const isAtmControlsLoading = isInitialReadLoading || isControlsReadOut
  /** Without a session nothing was asked, so there is nothing to have failed. A read that
   *  is out is loading, not failed, even before Apollo reports it loading. */
  const hasInitialReadFailed = isAuthed && !loading && !hasCard
  const hasReadFailed = hasInitialReadFailed || hasControlsReadFailed
  const hasAtmControlsFailed = hasReadFailed && !isAtmControlsLoading
  const atmDailyLimitCents = findAtmLimitCents(card?.spendingLimits, SpendingPeriod.Daily)
  const atmMonthlyLimitCents = findAtmLimitCents(
    card?.spendingLimits,
    SpendingPeriod.Monthly,
  )

  /** A card without an ATM toggle was never restricted, and the backend lets its
   *  withdrawals through. While a change is saving the switch holds the requested
   *  value, and a failed save drops it so the switch goes back to the saved one. */
  const savedAtmEnabled =
    card?.spendingToggles.find(({ category }) => category === SpendingCategory.Atm)
      ?.enabled ?? true
  const isAtmEnabled = pendingAtmEnabled ?? savedAtmEnabled
  const isTogglingAtm = pendingAtmEnabled !== null

  /** The controls come back only once the server has answered this read, and only the
   *  latest read settles them, so one that was superseded cannot show what an older answer
   *  held. A read that fails stays failed, with the retry, rather than falling back to
   *  values the server may no longer hold; the client's error link has already recorded a
   *  transport failure. */
  const readControlsAgain = useCallback(async () => {
    latestReadRef.current += 1
    const read = latestReadRef.current
    markControlsRead("reading")
    try {
      await withTimeout(refetch(), CONTROLS_READ_TIMEOUT_MS, "Card ATM controls read")
      if (read === latestReadRef.current) markControlsRead("settled")
    } catch {
      if (read === latestReadRef.current) markControlsRead("failed")
    }
  }, [refetch, markControlsRead])

  const areControlsHeldBack = () => controlsReadRef.current !== "settled"

  /** A refusal from the server leaves the controls as they were. A save lost on the
   *  network, or answered with nothing, may still have landed, so the controls are held
   *  back until the server says what it holds, and the save settles only after that read:
   *  no stale value shows as current, and no later save can start before it. */
  const applyUpdate = useCallback(
    async <T>(
      mutate: () => Promise<FetchResult<T>>,
      failureMessage: string,
    ): Promise<boolean> => {
      try {
        const { data: result, errors } = await mutate()
        if (errors) {
          toastShow({ message: getErrorMessages(errors), LL })
          return false
        }
        if (result) return true
        toastShow({ message: failureMessage, LL })
      } catch (err) {
        toastShow({ message: err instanceof Error ? err.message : failureMessage, LL })
        /** The client's error policy throws a refusal rather than returning it: only a
         *  request lost on the network leaves the outcome unknown. */
        if (!isNetworkFailure(err)) return false
      }
      await readControlsAgain()
      return false
    },
    [LL, readControlsAgain],
  )

  const saveAtmLimit = useCallback(
    async <T>(period: SpendingPeriod, mutate: () => Promise<FetchResult<T>>) => {
      setUpdatingAtmLimit(period)
      const isSaved = await applyUpdate(mutate, LL.CardFlow.CardLimits.limitUpdateError())
      setUpdatingAtmLimit(null)

      if (isSaved) {
        toastShow({
          message: LL.CardFlow.CardLimits.limitUpdateSuccess(),
          LL,
          type: "success",
        })
      }
    },
    [applyUpdate, LL],
  )

  /** An emptied field lifts the limit, since an ATM limit is optional and the
   *  backend only accepts amounts above zero. */
  const updateAtmLimit = useCallback(
    async (period: SpendingPeriod, currentLimitCents: number | null, dollars: string) => {
      if (areControlsHeldBack()) return
      const input = { cardId, category: SpendingCategory.Atm, period }

      const isCleared = dollars.trim() === ""
      if (isCleared) {
        if (currentLimitCents === null) return
        await saveAtmLimit(period, () =>
          cardSpendingLimitRemove({ variables: { input } }),
        )
        return
      }

      const limitCents = parseDollarsToCents(dollars)
      if (limitCents === null) {
        toastShow({ message: LL.CardFlow.CardLimits.invalidLimitAmount(), LL })
        return
      }
      if (limitCents === currentLimitCents) return

      const isPositive = limitCents > 0
      if (!isPositive) {
        toastShow({ message: LL.CardFlow.CardLimits.limitMustBePositive(), LL })
        return
      }

      await saveAtmLimit(period, () =>
        cardSpendingLimitSet({ variables: { input: { ...input, limitCents } } }),
      )
    },
    [cardId, saveAtmLimit, cardSpendingLimitRemove, cardSpendingLimitSet, LL],
  )

  const handleUpdateAtmDailyLimit = useCallback(
    (dollars: string) =>
      updateAtmLimit(SpendingPeriod.Daily, atmDailyLimitCents, dollars),
    [updateAtmLimit, atmDailyLimitCents],
  )

  const handleUpdateAtmMonthlyLimit = useCallback(
    (dollars: string) =>
      updateAtmLimit(SpendingPeriod.Monthly, atmMonthlyLimitCents, dollars),
    [updateAtmLimit, atmMonthlyLimitCents],
  )

  const handleToggleAtm = useCallback(
    async (enabled: boolean) => {
      if (areControlsHeldBack()) return
      setPendingAtmEnabled(enabled)
      await applyUpdate(
        () =>
          cardSpendingToggleSet({
            variables: { input: { cardId, category: SpendingCategory.Atm, enabled } },
          }),
        LL.CardFlow.CardLimits.atmToggleError(),
      )
      setPendingAtmEnabled(null)
    },
    [applyUpdate, cardSpendingToggleSet, cardId, LL],
  )

  return {
    atmDailyLimitCents,
    atmMonthlyLimitCents,
    isAtmEnabled,
    hasAtmControls,
    isAtmControlsLoading,
    hasAtmControlsFailed,
    retryAtmControls: readControlsAgain,
    updatingAtmLimit,
    isTogglingAtm,
    handleUpdateAtmDailyLimit,
    handleUpdateAtmMonthlyLimit,
    handleToggleAtm,
  }
}
