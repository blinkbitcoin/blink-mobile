import { useCallback } from "react"
import { gql } from "@apollo/client"

import { CardStatus, useCardUpdateMutation } from "@app/graphql/generated"
import { getErrorMessages } from "@app/graphql/utils"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toastShow } from "@app/utils/toast"

gql`
  mutation cardUpdate($input: CardUpdateInput!) {
    cardUpdate(input: $input) {
      id
      status
    }
  }
`

export const useCardFreeze = () => {
  const [cardUpdateMutation, { loading }] = useCardUpdateMutation()
  const { LL } = useI18nContext()

  const handleFreeze = useCallback(
    async (cardId: string, currentStatus: CardStatus) => {
      const nextStatus =
        currentStatus === CardStatus.Active ? CardStatus.Locked : CardStatus.Active

      try {
        const { data, errors } = await cardUpdateMutation({
          variables: { input: { cardId, status: nextStatus } },
          optimisticResponse: {
            __typename: "Mutation",
            cardUpdate: { __typename: "Card", id: cardId, status: nextStatus },
          },
        })

        if (errors) {
          toastShow({ message: getErrorMessages(errors), LL })
          return
        }

        if (!data?.cardUpdate) {
          toastShow({ message: LL.CardFlow.CardDashboard.cardUpdateError(), LL })
        }
      } catch (err) {
        if (err instanceof Error) {
          toastShow({ message: err.message, LL })
        }
      }
    },
    [cardUpdateMutation, LL],
  )

  return { handleFreeze, loading }
}
