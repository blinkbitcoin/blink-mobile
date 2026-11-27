import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useCardBalance } from "@app/hooks/use-card-balance"
import { useCardData } from "@app/hooks/use-card-data"
import { useIsCardBackendAvailable } from "@app/hooks/use-is-card-backend-available"
import { isCardUsable } from "@app/screens/card-screen/utils/card-display"

export type TransferCard = {
  id: string
  /** The sats the card can spend; undefined until blink-card answers. */
  availableSats: number | undefined
}

/**
 * The member's card as a balance the Transfer moves money with (R31): a custodial
 * account's card while it can be used, as on Home. Pending while the card lookup has not
 * answered, so a card holder is never taken for an account without one.
 */
export const useTransferCard = () => {
  const isCardBackendAvailable = useIsCardBackendAvailable()
  const { isSelfCustodial } = useActiveWallet()
  const isCardQueryEnabled = isCardBackendAvailable && !isSelfCustodial

  const { card, hasLoaded, error } = useCardData({ skip: !isCardQueryEnabled })
  const usableCard = card && isCardUsable(card.status) ? card : undefined
  const { availableSats } = useCardBalance(usableCard?.id)

  const hasLookupFailed = error !== undefined
  const isPending = isCardQueryEnabled && !hasLoaded && !hasLookupFailed
  const transferCard: TransferCard | undefined = usableCard && {
    id: usableCard.id,
    availableSats,
  }

  return { card: transferCard, isPending }
}
