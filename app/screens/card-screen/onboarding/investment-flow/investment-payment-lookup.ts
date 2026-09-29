import * as React from "react"

import {
  useHomeUnauthedQuery,
  useTransactionsByPaymentHashLazyQuery,
} from "@app/graphql/generated"
import { useSendWallets } from "@app/screens/send-bitcoin-screen/hooks/use-send-wallets"
import {
  getPaymentHashFromInvoice,
  resolveSettledOutcome,
} from "@app/screens/send-bitcoin-screen/hooks/use-verify-payment-settled"
import { CardInvestmentPaymentLookup } from "@app/types/card-investment"

/** The sends one wallet holds for a payment hash, or undefined when it could not be
 *  asked. An empty list is an answer: the wallet was asked and holds none. */
type FetchSends = (
  walletId: string,
  paymentHash: string,
) => Promise<Parameters<typeof resolveSettledOutcome>[0]>

/**
 * Whether the investment's invoice was paid from any of the account's wallets. The
 * record does not say which wallet paid, so each is asked in turn, once: a payment made
 * some time ago is in the ledger or it is not. The first settlement found is the answer.
 * Nothing found counts as unpaid only when every wallet answered; a wallet that could not
 * be asked, no wallet to ask, or no hash to ask with leaves the answer unknown.
 */
export const lookUpInvestmentPayment = async ({
  fetchSends,
  walletIds,
  paymentHash,
}: {
  fetchSends: FetchSends
  walletIds: readonly string[]
  paymentHash: string | undefined
}): Promise<CardInvestmentPaymentLookup> => {
  if (!paymentHash || walletIds.length === 0) return CardInvestmentPaymentLookup.Unknown

  let hasUnansweredWallet = false
  for (const walletId of walletIds) {
    const sends = await fetchSends(walletId, paymentHash).catch(() => undefined)
    const outcome = sends ? resolveSettledOutcome(sends) : undefined
    if (outcome?.status === "SUCCESS") return CardInvestmentPaymentLookup.Settled
    if (outcome?.status === "PENDING") return CardInvestmentPaymentLookup.Pending
    if (!sends) hasUnansweredWallet = true
  }

  if (hasUnansweredWallet) return CardInvestmentPaymentLookup.Unknown
  return CardInvestmentPaymentLookup.NotFound
}

/**
 * Asks the ledger about an invoice, from the account's own wallets. For the step about to
 * mint a replacement invoice, and for the home reconciling a payment it only knows as on
 * its way. The same query and hash decoding the send flow's settlement check uses, asked
 * once per wallet and with a failed request kept apart from an empty answer, which that
 * check folds together.
 */
export const useLookUpInvestmentPayment = (): ((
  paymentRequest: string,
) => Promise<CardInvestmentPaymentLookup>) => {
  /** no-cache: a one-shot ledger check must not read or pollute the persisted cache. */
  const [fetchTransactionsByPaymentHash] = useTransactionsByPaymentHashLazyQuery({
    fetchPolicy: "no-cache",
  })
  const { data: unauthedData } = useHomeUnauthedQuery({ fetchPolicy: "cache-first" })
  const network = unauthedData?.globals?.network
  const { wallets } = useSendWallets()
  const walletIds = React.useMemo(() => (wallets ?? []).map(({ id }) => id), [wallets])

  return React.useCallback(
    (paymentRequest: string) =>
      lookUpInvestmentPayment({
        walletIds,
        paymentHash: network
          ? getPaymentHashFromInvoice(paymentRequest, network)
          : undefined,
        fetchSends: async (walletId, paymentHash) => {
          const { data } = await fetchTransactionsByPaymentHash({
            variables: { walletId, paymentHash },
          })
          return (
            data?.me?.defaultAccount?.walletById?.transactionsByPaymentHash ?? undefined
          )
        },
      }),
    [fetchTransactionsByPaymentHash, network, walletIds],
  )
}
