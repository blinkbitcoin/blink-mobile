import { useCallback, useState } from "react"
import { gql } from "@apollo/client"

import { useCardSecretsEncryptedLazyQuery } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { decryptAesGcm, encryptRsaOaep, generateRandomHexKey } from "@app/utils/crypto"
import { recordAppError, toError } from "@app/utils/error-reporting"

import { useCardEncryption } from "./use-card-encryption"

gql`
  query cardSecretsEncrypted($cardId: ID!, $sessionId: String!) {
    cardSecretsEncrypted(cardId: $cardId, sessionId: $sessionId) {
      encryptedPan {
        iv
        data
      }
      encryptedCvc {
        iv
        data
      }
    }
  }
`

type CardSecrets = {
  pan: string
  cvc: string
}

export const useCardSecrets = () => {
  const { LL } = useI18nContext()
  const { fetchPublicKey } = useCardEncryption()
  /** Kept out of the Apollo cache, which is persisted to disk: the encrypted card
   *  number and CVV have no reason to outlive the screen that asked for them. */
  const [fetchEncryptedSecrets] = useCardSecretsEncryptedLazyQuery({
    fetchPolicy: "no-cache",
  })
  const [secrets, setSecrets] = useState<CardSecrets | undefined>()
  const [error, setError] = useState<string | undefined>()

  const fetchSecrets = useCallback(
    async (cardId: string): Promise<CardSecrets | undefined> => {
      setError(undefined)
      try {
        /** From the server every time, so a retry after the key rotates does not keep
         *  sealing the session with the stale key the persisted cache still holds. */
        const { data: publicKeyData } = await fetchPublicKey({
          fetchPolicy: "network-only",
        })
        const publicKeyPem = publicKeyData?.cardEncryptionPublicKey
        if (!publicKeyPem) throw new Error("Card encryption public key is missing")

        const secretKey = generateRandomHexKey()
        const sessionId = encryptRsaOaep(publicKeyPem, secretKey)

        const { data } = await fetchEncryptedSecrets({
          variables: { cardId, sessionId },
        })

        const encrypted = data?.cardSecretsEncrypted
        if (!encrypted) throw new Error("Encrypted card secrets are missing")

        const pan = decryptAesGcm({
          data: encrypted.encryptedPan.data,
          iv: encrypted.encryptedPan.iv,
          key: secretKey,
        })
        const cvc = decryptAesGcm({
          data: encrypted.encryptedCvc.data,
          iv: encrypted.encryptedCvc.iv,
          key: secretKey,
        })

        const result = { pan, cvc }
        setSecrets(result)
        return result
      } catch (err) {
        recordAppError(toError(err))
        /** One localized message for every failure: a network, crypto or library
         *  message would reach the screen untranslated. */
        setError(LL.errors.unexpectedError())
        return undefined
      }
    },
    [fetchPublicKey, fetchEncryptedSecrets, LL],
  )

  return { secrets, error, fetchSecrets }
}
