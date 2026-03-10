import { useCallback } from "react"

import { CardStatus, useCardUpdateMutation } from "@app/graphql/generated"
import { getErrorMessages } from "@app/graphql/utils"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toastShow } from "@app/utils/toast"

export const useLockCard = () => {
  const [cardUpdateMutation, { loading }] = useCardUpdateMutation()
  const { LL } = useI18nContext()

  const lockCard = useCallback(
    async (cardId: string): Promise<boolean> => {
      try {
        const { data, errors } = await cardUpdateMutation({
          variables: { input: { cardId, status: CardStatus.Locked } },
        })

        if (errors) {
          toastShow({ message: getErrorMessages(errors), LL })
          return false
        }

        if (!data?.cardUpdate) {
          toastShow({ message: LL.CardFlow.ReplaceCard.errors.lockFailed(), LL })
          return false
        }

        return true
      } catch (err) {
        if (err instanceof Error) {
          toastShow({ message: err.message, LL })
        }
        return false
      }
    },
    [cardUpdateMutation, LL],
  )

  return { lockCard, loading }
}
