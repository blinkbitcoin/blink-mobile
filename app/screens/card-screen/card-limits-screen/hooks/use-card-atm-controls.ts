import { useCallback, useState } from "react"
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
import { getErrorMessages } from "@app/graphql/utils"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toMinorUnit } from "@app/utils/helper"
import { toastShow } from "@app/utils/toast"

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

  const { data, loading } = useCardSpendingControlsQuery({
    skip: !isAuthed,
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
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

        if (!result) {
          toastShow({ message: failureMessage, LL })
          return false
        }

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : failureMessage
        toastShow({ message, LL })
        return false
      }
    },
    [LL],
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
      const input = { cardId, category: SpendingCategory.Atm, period }

      const isCleared = dollars.trim() === ""
      if (isCleared) {
        if (currentLimitCents === null) return
        await saveAtmLimit(period, () =>
          cardSpendingLimitRemove({ variables: { input } }),
        )
        return
      }

      const limitCents = toMinorUnit(dollars)
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
    hasAtmControls: card !== undefined,
    loading,
    updatingAtmLimit,
    isTogglingAtm,
    handleUpdateAtmDailyLimit,
    handleUpdateAtmMonthlyLimit,
    handleToggleAtm,
  }
}
