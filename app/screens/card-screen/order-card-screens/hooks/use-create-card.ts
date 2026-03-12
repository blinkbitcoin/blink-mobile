import { useCallback } from "react"
import { gql } from "@apollo/client"

import {
  CardType,
  ShippingAddressInput,
  useCardCreateMutation,
} from "@app/graphql/generated"
import { getErrorMessages } from "@app/graphql/utils"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toastShow } from "@app/utils/toast"

gql`
  mutation cardCreate($input: CardCreateInput!) {
    cardCreate(input: $input) {
      id
      lastFour
      cardType
      status
    }
  }
`

type CreateResult = {
  lastFour: string
  cardType: CardType
}

type CreateCardParams = {
  applicationId: string
  shippingAddress: ShippingAddressInput
}

export const useCreateCard = () => {
  const [cardCreateMutation, { loading }] = useCardCreateMutation()
  const { LL } = useI18nContext()

  const createCard = useCallback(
    async ({
      applicationId,
      shippingAddress,
    }: CreateCardParams): Promise<CreateResult | null> => {
      try {
        const { data, errors } = await cardCreateMutation({
          variables: {
            input: {
              applicationId,
              cardType: CardType.Physical,
              shippingAddress,
            },
          },
        })

        if (errors) {
          toastShow({ message: getErrorMessages(errors), LL })
          return null
        }

        if (!data?.cardCreate) {
          toastShow({
            message: LL.CardFlow.OrderPhysicalCard.errors.createFailed(),
            LL,
          })
          return null
        }

        return {
          lastFour: data.cardCreate.lastFour,
          cardType: data.cardCreate.cardType,
        }
      } catch (err) {
        if (err instanceof Error) {
          toastShow({ message: err.message, LL })
        }
        return null
      }
    },
    [cardCreateMutation, LL],
  )

  return { createCard, loading }
}
