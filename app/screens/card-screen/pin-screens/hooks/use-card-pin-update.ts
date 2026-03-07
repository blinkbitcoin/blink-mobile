import { useCallback } from "react"
import { gql } from "@apollo/client"

import { useCardPinUpdateMutation } from "@app/graphql/generated"
import { getErrorMessages } from "@app/graphql/utils"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toastShow } from "@app/utils/toast"

import { useCardData } from "../../hooks/use-card-data"
import { formatPinBlock } from "../format-pin-block"

gql`
  mutation cardPinUpdate($input: CardPinUpdateInput!) {
    cardPinUpdate(input: $input)
  }
`

export const useCardPinUpdate = () => {
  const [cardPinUpdateMutation, { loading }] = useCardPinUpdateMutation()
  const { card } = useCardData()
  const { LL } = useI18nContext()

  const updatePin = useCallback(
    async (pin: string): Promise<boolean> => {
      const cardId = card?.id
      if (!cardId) {
        toastShow({ message: LL.CardFlow.PinScreens.common.cardNotFound(), LL })
        return false
      }

      // TODO: Replace with real encryption (RSA-OAEP + AES-128-GCM) when crypto library is added
      const encryptedPin = formatPinBlock(pin)
      const iv = ""
      const sessionId = ""

      try {
        const { data, errors } = await cardPinUpdateMutation({
          variables: { input: { cardId, encryptedPin, iv, sessionId } },
        })

        if (errors) {
          toastShow({ message: getErrorMessages(errors), LL })
          return false
        }

        if (!data?.cardPinUpdate) {
          toastShow({
            message: LL.CardFlow.PinScreens.common.pinUpdateFailed(),
            LL,
          })
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
    [cardPinUpdateMutation, card, LL],
  )

  return { updatePin, loading }
}
