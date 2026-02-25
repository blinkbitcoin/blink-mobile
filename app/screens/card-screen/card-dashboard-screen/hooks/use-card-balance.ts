import { gql } from "@apollo/client"

import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useCardBalanceQuery } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { toBtcMoneyAmount } from "@app/types/amounts"

gql`
  query cardBalance($cardId: ID!) {
    cardBalance(cardId: $cardId) {
      available
      pending
      posted
    }
  }
`

const BALANCE_POLL_INTERVAL_MS = 30_000

export const useCardBalance = (cardId: string | undefined) => {
  const isAuthed = useIsAuthed()
  const { moneyAmountToDisplayCurrencyString, formatMoneyAmount } = useDisplayCurrency()

  const { data, loading, error } = useCardBalanceQuery({
    variables: { cardId: cardId ?? "" },
    skip: !isAuthed || !cardId,
    fetchPolicy: "network-only",
    pollInterval: BALANCE_POLL_INTERVAL_MS,
  })

  const availableSats = data?.cardBalance?.available ?? 0
  const btcAmount = toBtcMoneyAmount(availableSats)

  const balancePrimary =
    moneyAmountToDisplayCurrencyString({ moneyAmount: btcAmount, isApproximate: true }) ??
    ""

  const balanceSecondary =
    formatMoneyAmount({ moneyAmount: btcAmount, isApproximate: false }) ?? ""

  return { balancePrimary, balanceSecondary, loading, error }
}
