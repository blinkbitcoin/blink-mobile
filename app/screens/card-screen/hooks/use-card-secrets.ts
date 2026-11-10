import { useCallback, useEffect, useRef, useState } from "react"
import { gql } from "@apollo/client"

import { useCardSecretsEncryptedLazyQuery } from "@app/graphql/generated"
import { decryptAesGcm, encryptRsaOaep, generateRandomHexKey } from "@app/utils/crypto"
import { recordAppError, toError } from "@app/utils/error-reporting"
import { withTimeout } from "@app/utils/with-timeout"

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

/** Neither request has a deadline of its own, so one stalled on a broken connection would
 *  hold the screen on its loader for good. Sized for both requests taking the transport's
 *  single unauthorized retry, 5 s each (createUnauthorizedRetryLink in
 *  app/graphql/retry-policy.ts), with the rest left for four slow round trips. */
const SECRETS_ATTEMPT_TIMEOUT_MS = 30_000

type CardSecrets = {
  pan: string
  cvc: string
}

/**
 * The decrypted card number and CVV, fetched on demand. A failure is a flag rather than a
 * message: the screen words it, which keeps the locale out of `fetchSecrets` so a language
 * change cannot start a second fetch. Only the latest attempt lands, so a retry tapped
 * twice, or one started while another is still out, never mixes the answer of one with
 * the failure of the other.
 */
export const useCardSecrets = () => {
  const { fetchPublicKey } = useCardEncryption()
  /** Kept out of the Apollo cache, which is persisted to disk: the encrypted card
   *  number and CVV have no reason to outlive the screen that asked for them. */
  const [fetchEncryptedSecrets] = useCardSecretsEncryptedLazyQuery({
    fetchPolicy: "no-cache",
  })
  const [secrets, setSecrets] = useState<CardSecrets | undefined>()
  const [hasFailed, setHasFailed] = useState(false)
  const latestAttemptRef = useRef(0)

  /** Leaving the screen supersedes whatever attempt is still out, so it neither reports
   *  a failure nobody is there to see nor decrypts an answer nobody will read. */
  useEffect(
    () => () => {
      latestAttemptRef.current += 1
    },
    [],
  )

  /** Clearing the failure first takes the retry off the screen while the attempt runs.
   *  An attempt that timed out or was superseded is abandoned: it stops before asking for
   *  the secrets and before decrypting them, and whatever it settles with is dropped. */
  const fetchSecrets = useCallback(
    async (cardId: string): Promise<CardSecrets | undefined> => {
      latestAttemptRef.current += 1
      const attempt = latestAttemptRef.current
      const isLatestAttempt = () => attempt === latestAttemptRef.current
      let isSettled = false
      const stopIfAbandoned = () => {
        if (isSettled || !isLatestAttempt()) {
          throw new Error("Card secrets attempt abandoned")
        }
      }

      const readSecrets = async (): Promise<CardSecrets> => {
        /** From the server every time, so a retry after the key rotates does not keep
         *  sealing the session with the stale key the persisted cache still holds. */
        const { data: publicKeyData } = await fetchPublicKey({
          fetchPolicy: "network-only",
        })
        stopIfAbandoned()
        const publicKeyPem = publicKeyData?.cardEncryptionPublicKey
        if (!publicKeyPem) throw new Error("Card encryption public key is missing")

        const secretKey = generateRandomHexKey()
        const sessionId = encryptRsaOaep(publicKeyPem, secretKey)

        const { data } = await fetchEncryptedSecrets({
          variables: { cardId, sessionId },
        })
        stopIfAbandoned()
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

        return { pan, cvc }
      }

      setHasFailed(false)
      try {
        const result = await withTimeout(
          readSecrets(),
          SECRETS_ATTEMPT_TIMEOUT_MS,
          "Card secrets fetch",
        )
        if (!isLatestAttempt()) return undefined
        setSecrets(result)
        return result
      } catch (err) {
        if (!isLatestAttempt()) return undefined
        recordAppError(toError(err))
        setHasFailed(true)
        return undefined
      } finally {
        isSettled = true
      }
    },
    [fetchPublicKey, fetchEncryptedSecrets],
  )

  return { secrets, hasFailed, fetchSecrets }
}
