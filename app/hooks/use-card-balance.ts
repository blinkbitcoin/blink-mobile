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

  const { data, loading, error, refetch } = useCardBalanceQuery({
    variables: { cardId: cardId ?? "" },
    skip: !isAuthed || !cardId,
    fetchPolicy: "network-only",
    pollInterval: BALANCE_POLL_INTERVAL_MS,
  })

  /** Undefined until the balance arrives, so a pending or failed request is never
   *  mistaken for a card that holds nothing. */
  const availableSats = data?.cardBalance?.available
  const btcAmount = toBtcMoneyAmount(availableSats ?? 0)

  /** The Card Balance is held in bitcoin, so it reads in bitcoin first, as the wallets on
   *  Home do, with the display currency under it. */
  const balancePrimary =
    formatMoneyAmount({ moneyAmount: btcAmount, isApproximate: false }) ?? ""

  const balanceSecondary =
    moneyAmountToDisplayCurrencyString({ moneyAmount: btcAmount, isApproximate: true }) ??
    ""

  return { balancePrimary, balanceSecondary, availableSats, loading, error, refetch }
}
