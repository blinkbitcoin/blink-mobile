import { useCallback, useState } from "react"
import { gql } from "@apollo/client"

import { useCardUpdateLimitsMutation } from "@app/graphql/generated"
import { getErrorMessages } from "@app/graphql/utils"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toMinorUnit } from "@app/utils/helper"
import { toastShow } from "@app/utils/toast"

import type { LimitField } from "./types"

gql`
  mutation cardUpdateLimits($input: CardUpdateInput!) {
    cardUpdate(input: $input) {
      id
      dailyLimitCents
      monthlyLimitCents
    }
  }
`

type UpdatingField = LimitField | null

export const useCardLimits = (cardId: string) => {
  const [cardUpdateLimitsMutation] = useCardUpdateLimitsMutation()
  const { LL } = useI18nContext()
  const [updatingField, setUpdatingField] = useState<UpdatingField>(null)

  const handleUpdateLimit = useCallback(
    async (field: LimitField, dollars: string) => {
      const limitInputKey: Record<LimitField, "dailyLimitCents" | "monthlyLimitCents"> = {
        daily: "dailyLimitCents",
        monthly: "monthlyLimitCents",
      }

      const minorUnits = toMinorUnit(dollars)
      if (minorUnits <= 0) {
        toastShow({ message: LL.CardFlow.CardLimits.limitMustBePositive(), LL })
        return
      }

      setUpdatingField(field)
      try {
        const { data, errors } = await cardUpdateLimitsMutation({
          variables: { input: { cardId, [limitInputKey[field]]: minorUnits } },
        })

        if (errors) {
          toastShow({ message: getErrorMessages(errors), LL })
          return
        }

        if (!data?.cardUpdate) {
          toastShow({ message: LL.CardFlow.CardLimits.limitUpdateError(), LL })
          return
        }

        toastShow({
          message: LL.CardFlow.CardLimits.limitUpdateSuccess(),
          LL,
          type: "success",
        })
      } catch (err) {
        const message =
          err instanceof Error ? err.message : LL.CardFlow.CardLimits.limitUpdateError()
        toastShow({ message, LL })
      } finally {
        setUpdatingField(null)
      }
    },
    [cardUpdateLimitsMutation, cardId, LL],
  )

  const handleUpdateDailyLimit = useCallback(
    (dollars: string) => handleUpdateLimit("daily", dollars),
    [handleUpdateLimit],
  )

  const handleUpdateMonthlyLimit = useCallback(
    (dollars: string) => handleUpdateLimit("monthly", dollars),
    [handleUpdateLimit],
  )

  return { handleUpdateDailyLimit, handleUpdateMonthlyLimit, updatingField }
}
