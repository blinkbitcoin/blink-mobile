import { useCallback } from "react"
import { gql } from "@apollo/client"

import { CardType, useCardReplaceMutation } from "@app/graphql/generated"
import { getErrorMessages } from "@app/graphql/utils"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toastShow } from "@app/utils/toast"

gql`
  mutation cardReplace($input: CardReplaceInput!) {
    cardReplace(input: $input) {
      id
      lastFour
      cardType
      status
    }
  }
`

type ReplaceResult = {
  lastFour: string
  cardType: CardType
}

export const useReplaceCard = () => {
  const [cardReplaceMutation, { loading }] = useCardReplaceMutation()
  const { LL } = useI18nContext()

  const replaceCard = useCallback(
    async (cardId: string): Promise<ReplaceResult | null> => {
      try {
        const { data, errors } = await cardReplaceMutation({
          variables: { input: { cardId } },
        })

        if (errors) {
          toastShow({ message: getErrorMessages(errors), LL })
          return null
        }

        if (!data?.cardReplace) {
          toastShow({ message: LL.CardFlow.ReplaceCard.errors.replaceFailed(), LL })
          return null
        }

        return {
          lastFour: data.cardReplace.lastFour,
          cardType: data.cardReplace.cardType,
        }
      } catch (err) {
        if (err instanceof Error) {
          toastShow({ message: err.message, LL })
        }
        return null
      }
    },
    [cardReplaceMutation, LL],
  )

  return { replaceCard, loading }
}
