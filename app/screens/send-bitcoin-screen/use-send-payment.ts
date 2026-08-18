import { useMemo, useState } from "react"
import Crypto from "react-native-quick-crypto"

import { gql } from "@apollo/client"
import {
  HomeAuthedDocument,
  PaymentSendResult,
  useIntraLedgerPaymentSendMutation,
  useIntraLedgerUsdPaymentSendMutation,
  useLnInvoicePaymentSendMutation,
  useLnNoAmountInvoicePaymentSendMutation,
  useLnNoAmountUsdInvoicePaymentSendMutation,
  useOnChainPaymentSendMutation,
  useOnChainPaymentSendAllMutation,
  useOnChainUsdPaymentSendAsBtcDenominatedMutation,
  useOnChainUsdPaymentSendMutation,
  Transaction,
} from "@app/graphql/generated"
import { getErrorMessages } from "@app/graphql/utils"
import { reportError } from "@app/utils/error-logging"

import {
  IdempotencyKeyRef,
  PaymentSendExtraInfo,
  SendPaymentMutation,
} from "./payment-details/index.types"

export type PaymentSendCompletedStatus = "SUCCESS" | "PENDING"

type UseSendPaymentResult = {
  loading: boolean
  sendPayment:
    | (() => Promise<{
        status: PaymentSendResult | null | undefined
        transaction?: Partial<Transaction> | null
        errorsMessage?: string
        extraInfo?: PaymentSendExtraInfo
      }>)
    | undefined
    | null
  /**
   * A send attempt reached the network, so money may already have moved. Sticky for the
   * life of the mount: it stays true even after a failure, because the caller uses it to
   * stop validating against a balance the backend may already have debited. It does NOT
   * mean "the send is spent" — whether another attempt is allowed is expressed by
   * sendPayment being defined.
   */
  hasAttemptedSend: boolean
}

/**
 * Thrown when the platform CSPRNG cannot mint an idempotency key. Nothing is sent: there
 * is deliberately no fallback, because a predictable or absent key is exactly the
 * weakness this header exists to close.
 */
export const IDEMPOTENCY_KEY_UNAVAILABLE = "idempotency-key-unavailable"

gql`
  mutation intraLedgerPaymentSend($input: IntraLedgerPaymentSendInput!) {
    intraLedgerPaymentSend(input: $input) {
      errors {
        message
      }
      status
      transaction {
        createdAt
      }
    }
  }

  mutation intraLedgerUsdPaymentSend($input: IntraLedgerUsdPaymentSendInput!) {
    intraLedgerUsdPaymentSend(input: $input) {
      errors {
        message
      }
      status
      transaction {
        createdAt
      }
    }
  }

  mutation lnNoAmountInvoicePaymentSend($input: LnNoAmountInvoicePaymentInput!) {
    lnNoAmountInvoicePaymentSend(input: $input) {
      errors {
        message
      }
      status
      transaction {
        createdAt
      }
    }
  }

  mutation lnInvoicePaymentSend($input: LnInvoicePaymentInput!) {
    lnInvoicePaymentSend(input: $input) {
      errors {
        message
      }
      status
      transaction {
        createdAt
        settlementVia {
          ... on SettlementViaLn {
            preImage
          }
          ... on SettlementViaIntraLedger {
            preImage
          }
        }
      }
    }
  }

  mutation lnNoAmountUsdInvoicePaymentSend($input: LnNoAmountUsdInvoicePaymentInput!) {
    lnNoAmountUsdInvoicePaymentSend(input: $input) {
      errors {
        message
      }
      status
      transaction {
        createdAt
      }
    }
  }

  mutation onChainPaymentSend($input: OnChainPaymentSendInput!) {
    onChainPaymentSend(input: $input) {
      transaction {
        createdAt
        settlementVia {
          ... on SettlementViaOnChain {
            arrivalInMempoolEstimatedAt
          }
        }
      }
      errors {
        message
      }
      status
    }
  }

  mutation onChainPaymentSendAll($input: OnChainPaymentSendAllInput!) {
    onChainPaymentSendAll(input: $input) {
      errors {
        message
      }
      status
      transaction {
        createdAt
      }
    }
  }

  mutation onChainUsdPaymentSend($input: OnChainUsdPaymentSendInput!) {
    onChainUsdPaymentSend(input: $input) {
      errors {
        message
      }
      status
      transaction {
        createdAt
      }
    }
  }

  mutation onChainUsdPaymentSendAsBtcDenominated(
    $input: OnChainUsdPaymentSendAsBtcDenominatedInput!
  ) {
    onChainUsdPaymentSendAsBtcDenominated(input: $input) {
      errors {
        message
      }
      status
      transaction {
        createdAt
      }
    }
  }
`

/**
 * Stamps the payment's idempotency key on a mutation. Applied to every mutate function at
 * the single point where they are handed to the payment detail, rather than inside each
 * of the eleven call sites in the factories, so a mutation added later cannot ship
 * without replay protection. The key deliberately overrides any context a factory might
 * supply: this hook owns the header.
 */
const withIdempotencyKey =
  <TOptions extends object, TResult>(
    mutate: (options?: TOptions) => TResult,
    idempotencyKey: string,
  ) =>
  (options?: TOptions): TResult =>
    mutate({
      ...(options ?? ({} as TOptions)),
      context: { headers: { "X-Idempotency-Key": idempotencyKey } },
    })

export const useSendPayment = (
  sendPaymentMutation?: SendPaymentMutation | null,
  idempotencyKeyRef?: IdempotencyKeyRef,
): UseSendPaymentResult => {
  const options = {
    refetchQueries: [HomeAuthedDocument],
  }

  const [intraLedgerPaymentSend, { loading: intraLedgerPaymentSendLoading }] =
    useIntraLedgerPaymentSendMutation(options)

  const [intraLedgerUsdPaymentSend, { loading: intraLedgerUsdPaymentSendLoading }] =
    useIntraLedgerUsdPaymentSendMutation(options)

  const [lnInvoicePaymentSend, { loading: lnInvoicePaymentSendLoading }] =
    useLnInvoicePaymentSendMutation(options)

  const [lnNoAmountInvoicePaymentSend, { loading: lnNoAmountInvoicePaymentSendLoading }] =
    useLnNoAmountInvoicePaymentSendMutation(options)

  const [
    lnNoAmountUsdInvoicePaymentSend,
    { loading: lnNoAmountUsdInvoicePaymentSendLoading },
  ] = useLnNoAmountUsdInvoicePaymentSendMutation(options)

  const [onChainPaymentSend, { loading: onChainPaymentSendLoading }] =
    useOnChainPaymentSendMutation(options)

  const [onChainPaymentSendAll, { loading: onChainPaymentSendAllLoading }] =
    useOnChainPaymentSendAllMutation(options)

  const [onChainUsdPaymentSend, { loading: onChainUsdPaymentSendLoading }] =
    useOnChainUsdPaymentSendMutation(options)

  const [
    onChainUsdPaymentSendAsBtcDenominated,
    { loading: onChainUsdPaymentSendAsBtcDenominatedLoading },
  ] = useOnChainUsdPaymentSendAsBtcDenominatedMutation(options)

  // Sticky: money may have moved, so the caller must stop trusting its balance snapshot.
  const [hasAttemptedSend, setHasAttemptedSend] = useState(false)
  /**
   * Whether a further attempt is barred. Kept apart from hasAttemptedSend because the two
   * answer different questions: a send that failed or threw must be retryable (same key,
   * so the backend refuses a true duplicate), while the balance check must stay off for
   * the rest of the mount regardless.
   */
  const [sendLocked, setSendLocked] = useState(false)
  // Tracks loading for mutations that bypass Apollo (e.g. self-custodial SDK calls)
  // so the UI still gets a loading signal while the mutation is in-flight.
  const [localLoading, setLocalLoading] = useState(false)

  const loading =
    localLoading ||
    intraLedgerPaymentSendLoading ||
    intraLedgerUsdPaymentSendLoading ||
    lnInvoicePaymentSendLoading ||
    lnNoAmountInvoicePaymentSendLoading ||
    lnNoAmountUsdInvoicePaymentSendLoading ||
    onChainPaymentSendLoading ||
    onChainPaymentSendAllLoading ||
    onChainUsdPaymentSendLoading ||
    onChainUsdPaymentSendAsBtcDenominatedLoading

  const sendPayment = useMemo(() => {
    return sendPaymentMutation && !sendLocked
      ? async () => {
          setSendLocked(true)
          setLocalLoading(true)

          /**
           * Minted here rather than during render for two reasons. It is the first
           * synchronous native (Nitro JSI) call on the custodial send path, and a throw
           * during render is uncatchable — it reaches the app-wide ErrorBoundary and
           * unmounts the whole tree. And the key belongs to the payment intent, which
           * outlives this screen's mount: it is stored on the ref carried by the payment
           * detail, so backing out of the confirmation screen and re-entering retries
           * under the original key and the backend can refuse the duplicate.
           */
          let idempotencyKey: string
          try {
            idempotencyKey = idempotencyKeyRef?.current ?? Crypto.randomUUID()
          } catch (err) {
            reportError("use-send-payment:idempotency-key", err)
            setSendLocked(false)
            setLocalLoading(false)
            throw new Error(IDEMPOTENCY_KEY_UNAVAILABLE)
          }
          if (idempotencyKeyRef) {
            idempotencyKeyRef.current = idempotencyKey
          }

          // Set only once the key exists and the mutation is about to fire: before this
          // point nothing has reached the network, so a CSPRNG failure must not suppress
          // the balance check for the rest of the mount.
          setHasAttemptedSend(true)

          try {
            const { status, errors, extraInfo, transaction } = await sendPaymentMutation({
              intraLedgerPaymentSend: withIdempotencyKey(
                intraLedgerPaymentSend,
                idempotencyKey,
              ),
              intraLedgerUsdPaymentSend: withIdempotencyKey(
                intraLedgerUsdPaymentSend,
                idempotencyKey,
              ),
              lnInvoicePaymentSend: withIdempotencyKey(
                lnInvoicePaymentSend,
                idempotencyKey,
              ),
              lnNoAmountInvoicePaymentSend: withIdempotencyKey(
                lnNoAmountInvoicePaymentSend,
                idempotencyKey,
              ),
              lnNoAmountUsdInvoicePaymentSend: withIdempotencyKey(
                lnNoAmountUsdInvoicePaymentSend,
                idempotencyKey,
              ),
              onChainPaymentSend: withIdempotencyKey(onChainPaymentSend, idempotencyKey),
              onChainPaymentSendAll: withIdempotencyKey(
                onChainPaymentSendAll,
                idempotencyKey,
              ),
              onChainUsdPaymentSend: withIdempotencyKey(
                onChainUsdPaymentSend,
                idempotencyKey,
              ),
              onChainUsdPaymentSendAsBtcDenominated: withIdempotencyKey(
                onChainUsdPaymentSendAsBtcDenominated,
                idempotencyKey,
              ),
            })
            let errorsMessage = undefined
            if (errors) {
              errorsMessage = getErrorMessages(errors)
            }
            if (status === PaymentSendResult.Failure) {
              setSendLocked(false)
            }
            return { status, errorsMessage, extraInfo, transaction }
          } catch (err) {
            // A throw is precisely the ambiguous case — the request may have landed. Let
            // the user attempt again under the same key, so a true duplicate comes back
            // as a 409 the screen can resolve, instead of dead-ending on a live payment.
            setSendLocked(false)
            throw err
          } finally {
            setLocalLoading(false)
          }
        }
      : undefined
  }, [
    sendLocked,
    idempotencyKeyRef,
    sendPaymentMutation,
    intraLedgerPaymentSend,
    intraLedgerUsdPaymentSend,
    lnInvoicePaymentSend,
    lnNoAmountInvoicePaymentSend,
    lnNoAmountUsdInvoicePaymentSend,
    onChainPaymentSend,
    onChainPaymentSendAll,
    onChainUsdPaymentSend,
    onChainUsdPaymentSendAsBtcDenominated,
  ])

  return {
    hasAttemptedSend,
    loading,
    sendPayment,
  }
}
