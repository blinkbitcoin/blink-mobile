import { useCallback } from "react"

import { gql } from "@apollo/client"
import {
  Network,
  TxDirection,
  TxStatus,
  useHomeUnauthedQuery,
  useTransactionsByPaymentHashLazyQuery,
} from "@app/graphql/generated"
import {
  getHashFromInvoice,
  Network as NetworkLibGaloy,
} from "@blinkbitcoin/blink-client"

import { PaymentSendCompletedStatus } from "../use-send-payment"

gql`
  query transactionsByPaymentHash($walletId: WalletId!, $paymentHash: PaymentHash!) {
    me {
      id
      defaultAccount {
        id
        walletById(walletId: $walletId) {
          id
          transactionsByPaymentHash(paymentHash: $paymentHash) {
            id
            status
            direction
            createdAt
          }
        }
      }
    }
  }
`

/** The 409 replay races the original request, so the transaction may not be visible on
 *  the first look — poll a few times before giving up. */
const VERIFY_ATTEMPTS = 3
const VERIFY_DELAY_MS = 2000

type SettledOutcome = {
  status: PaymentSendCompletedStatus
  createdAt?: number
}

type VerifiableTransaction = {
  status: TxStatus
  direction: TxDirection
  createdAt?: number
}

/** Decodes the payment hash from a bolt11 invoice; undefined when the input is not a
 *  decodable invoice for the given network (never throws). */
export const getPaymentHashFromInvoice = (
  paymentRequest: string,
  network: Network,
): string | undefined => {
  try {
    return getHashFromInvoice(paymentRequest, network as NetworkLibGaloy)
  } catch {
    return undefined
  }
}

/** Maps the transactions found for a payment hash to a completed-screen outcome. Only an
 *  outgoing SUCCESS or PENDING transaction is proof the payment was accepted — SUCCESS
 *  wins over PENDING, and a FAILURE-only result (or no send at all) yields undefined. */
export const resolveSettledOutcome = (
  transactions: ReadonlyArray<VerifiableTransaction> | undefined | null,
): SettledOutcome | undefined => {
  const sends = (transactions ?? []).filter((tx) => tx.direction === TxDirection.Send)
  const settled =
    sends.find((tx) => tx.status === TxStatus.Success) ??
    sends.find((tx) => tx.status === TxStatus.Pending)
  if (!settled) {
    return undefined
  }
  return {
    status: settled.status === TxStatus.Success ? "SUCCESS" : "PENDING",
    createdAt: settled.createdAt,
  }
}

/** Polls the injected fetcher until it yields a settled outcome or the attempts run out.
 *  A fetch error or empty result counts as "not found this attempt" and keeps polling. */
export const pollForSettledStatus = async (
  fetchTransactions: () => Promise<
    ReadonlyArray<VerifiableTransaction> | undefined | null
  >,
  { attempts, delayMs }: { attempts: number; delayMs: number },
): Promise<SettledOutcome | undefined> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delayMs)
      })
    }
    let transactions: ReadonlyArray<VerifiableTransaction> | undefined | null
    try {
      transactions = await fetchTransactions()
    } catch {
      transactions = undefined
    }
    const outcome = resolveSettledOutcome(transactions)
    if (outcome) {
      return outcome
    }
  }
  return undefined
}

/**
 * Ground-truth check for whether a payment the server may have already processed (a 409
 * idempotency conflict) actually settled: looks up the wallet's transactions by the
 * invoice's payment hash. Returns the outcome to show on the completed screen, or
 * undefined when the invoice is undecodable or no settled transaction appears in time.
 */
export const useVerifyPaymentSettled = (): ((args: {
  walletId: string
  paymentRequest: string
}) => Promise<SettledOutcome | undefined>) => {
  // no-cache: a one-shot settlement check must not read or pollute the persisted cache
  const [fetchTransactionsByPaymentHash] = useTransactionsByPaymentHashLazyQuery({
    fetchPolicy: "no-cache",
  })
  const { data: unauthedData } = useHomeUnauthedQuery({ fetchPolicy: "cache-first" })
  const network = unauthedData?.globals?.network

  return useCallback(
    async ({ walletId, paymentRequest }) => {
      const paymentHash = network
        ? getPaymentHashFromInvoice(paymentRequest, network)
        : undefined
      if (!paymentHash) {
        return undefined
      }
      return pollForSettledStatus(
        async () => {
          const { data } = await fetchTransactionsByPaymentHash({
            variables: { walletId, paymentHash },
          })
          return data?.me?.defaultAccount?.walletById?.transactionsByPaymentHash
        },
        { attempts: VERIFY_ATTEMPTS, delayMs: VERIFY_DELAY_MS },
      )
    },
    [fetchTransactionsByPaymentHash, network],
  )
}
