import { gql } from "@apollo/client"

import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useCardCollateralBalanceQuery } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { toBtcMoneyAmount } from "@app/types/amounts"

gql`
  query cardCollateralBalance {
    cardCollateralBalance {
      availableSats
      pendingSats
    }
  }
`

const BALANCE_POLL_INTERVAL_MS = 30_000

/** The Card Balance is the member's collateral, one for all their cards, which blink-card
 *  reads live. A member without a card has none to read, so the caller skips it. */
export const useCardBalance = ({ skip = false }: { skip?: boolean } = {}) => {
  const isAuthed = useIsAuthed()
  const { moneyAmountToDisplayCurrencyString, formatMoneyAmount } = useDisplayCurrency()

  const { data, loading, error, refetch } = useCardCollateralBalanceQuery({
    skip: !isAuthed || skip,
    fetchPolicy: "network-only",
    pollInterval: BALANCE_POLL_INTERVAL_MS,
  })

  /** Undefined until the balance arrives, so a pending or failed request is never
   *  mistaken for a card that holds nothing. */
  const availableSats = data?.cardCollateralBalance.availableSats
  /** What payments not settled yet hold. */
  const pendingSats = data?.cardCollateralBalance.pendingSats
  const btcAmount = toBtcMoneyAmount(availableSats ?? 0)

  /** The Card Balance is held in bitcoin, so it reads in bitcoin first, as the wallets on
   *  Home do, with the display currency under it. */
  const balancePrimary =
    formatMoneyAmount({ moneyAmount: btcAmount, isApproximate: false }) ?? ""

  const balanceSecondary =
    moneyAmountToDisplayCurrencyString({ moneyAmount: btcAmount, isApproximate: true }) ??
    ""

  return {
    balancePrimary,
    balanceSecondary,
    availableSats,
    pendingSats,
    loading,
    error,
    refetch,
  }
}
