import { useCallback, useState } from "react"
import { gql } from "@apollo/client"

import { useCardSecretsEncryptedLazyQuery } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { decryptAesGcm, encryptRsaOaep, generateRandomHexKey } from "@app/utils/crypto"
import { toastShow } from "@app/utils/toast"

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
  const [fetchEncryptedSecrets] = useCardSecretsEncryptedLazyQuery()
  const [secrets, setSecrets] = useState<CardSecrets | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)

  const fetchSecrets = useCallback(
    async (cardId: string): Promise<CardSecrets | undefined> => {
      setLoading(true)
      setError(undefined)
      try {
        const { data: publicKeyData } = await fetchPublicKey()
        const publicKeyPem = publicKeyData?.cardEncryptionPublicKey
        if (!publicKeyPem) return undefined

        const secretKey = generateRandomHexKey()
        const sessionId = encryptRsaOaep(publicKeyPem, secretKey)

        const { data } = await fetchEncryptedSecrets({
          variables: { cardId, sessionId },
        })

        const encrypted = data?.cardSecretsEncrypted
        if (!encrypted) return undefined

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
        const message = err instanceof Error ? err.message : ""
        setError(message)
        toastShow({ message, type: "warning", LL })
        return undefined
      } finally {
        setLoading(false)
      }
    },
    [fetchPublicKey, fetchEncryptedSecrets, LL],
  )

  return { secrets, loading, error, fetchSecrets }
}
