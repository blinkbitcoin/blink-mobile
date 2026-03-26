import { useCallback } from "react"
import { gql } from "@apollo/client"

import { useCardData } from "@app/hooks"
import { useCardEncryption } from "@app/screens/card-screen/hooks"
import { encryptPin } from "@app/screens/card-screen/utils"
import { useCardPinUpdateMutation } from "@app/graphql/generated"
import { getErrorMessages } from "@app/graphql/utils"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toastShow } from "@app/utils/toast"

gql`
  mutation cardPinUpdate($input: CardPinUpdateInput!) {
    cardPinUpdate(input: $input)
  }
`

export const useCardPinUpdate = () => {
  const [cardPinUpdateMutation, { loading: mutationLoading }] = useCardPinUpdateMutation()
  const { fetchPublicKey, loading: publicKeyLoading } = useCardEncryption()
  const { card } = useCardData()
  const { LL } = useI18nContext()

  const updatePin = useCallback(
    async (pin: string): Promise<boolean> => {
      const cardId = card?.id
      if (!cardId) {
        toastShow({ message: LL.CardFlow.PinScreens.common.cardNotFound(), LL })
        return false
      }

      try {
        const { data: publicKeyData } = await fetchPublicKey()
        const publicKeyPem = publicKeyData?.cardEncryptionPublicKey
        if (!publicKeyPem) {
          toastShow({
            message: LL.CardFlow.PinScreens.common.pinUpdateFailed(),
            LL,
          })
          return false
        }

        const { encryptedPin, iv, sessionId } = encryptPin(pin, publicKeyPem)

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
    [cardPinUpdateMutation, fetchPublicKey, card, LL],
  )

  return { updatePin, loading: mutationLoading || publicKeyLoading }
}
