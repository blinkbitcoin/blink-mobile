import { useEffect, useMemo } from "react"
import { InteractionManager } from "react-native"

import { useApolloClient } from "@apollo/client"

import {
  TransactionFragment,
  TransactionFragmentDoc,
  TxStatus,
} from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toTransactionFragments } from "@app/self-custodial/mappers/to-transaction-fragment"
import { getTransactionDescription } from "@app/self-custodial/mappers/transaction-description"
import { NormalizedTransaction } from "@app/types/transaction"

/**
 * Turns self-custodial transactions into the shared `TransactionFragment` shape and
 * primes the Apollo cache with them, because `TransactionItem` reads its data from the
 * cache by id and has no other way to see wallet-sourced transactions. Failed payments
 * are dropped: they are noise in a history list, not entries a user acted on.
 *
 * Every screen that lists self-custodial transactions needs both halves, so they live
 * here instead of being copied per screen.
 */
export const useSelfCustodialTransactionFragments = (
  transactions: readonly NormalizedTransaction[],
): TransactionFragment[] => {
  const client = useApolloClient()
  const { LL } = useI18nContext()
  const { convertMoneyAmount, displayCurrency } = usePriceConversion()
  const { fractionDigits } = useDisplayCurrency()

  const displayInfo = useMemo(
    () =>
      convertMoneyAmount
        ? { displayCurrency, convertMoneyAmount, fractionDigits }
        : undefined,
    [convertMoneyAmount, displayCurrency, fractionDigits],
  )

  const fragments = useMemo(() => {
    const describe = (tx: Parameters<typeof getTransactionDescription>[0]) =>
      getTransactionDescription(tx, LL)

    return toTransactionFragments(transactions, displayInfo, describe).filter(
      (tx) => tx.status !== TxStatus.Failure,
    )
  }, [transactions, displayInfo, LL])

  useEffect(() => {
    if (fragments.length === 0) return

    /** Deferred so a long transaction list never writes to the cache mid-interaction. */
    const task = InteractionManager.runAfterInteractions(() => {
      client.cache.batch({
        update: (cache) => {
          fragments.forEach((tx) => {
            cache.writeFragment({
              id: cache.identify({ __typename: "Transaction", id: tx.id }),
              fragment: TransactionFragmentDoc,
              fragmentName: "Transaction",
              data: tx,
            })
          })
        },
      })
    })

    return () => task.cancel()
  }, [client, fragments])

  return fragments
}
