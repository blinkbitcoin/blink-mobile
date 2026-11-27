import { useDollarBalanceGate } from "@app/hooks/use-dollar-balance-restricted"
import { useDollarBalanceRestrictionGuard } from "@app/hooks/use-dollar-balance-restriction-guard"
import { useTransferBlockedGuard } from "@app/hooks/use-transfer-blocked-guard"
import { CARD, CardCurrency } from "@app/types/amounts"

import { useTransferCard } from "./use-transfer-card"

type UseTransferAccessInput = {
  /** The destination the route asks for; only the member's own card can be one. */
  requestedDestination: CardCurrency | undefined
  isDrainConversion: boolean
}

/**
 * Who may open the Transfer, and with which balances. A drain conversion waives the region
 * restriction that would otherwise bounce a restricted user home: emptying the dollar
 * balance is the one way to migrate or to switch to Anon Mode, and the flow arming the flag
 * (not a deep-linkable param) is what confirms it. A card holder keeps the Transfer
 * wherever they are, since it is how they fund the card (D82); a restricted Dollar Balance
 * is left out of its choices instead. The card lookup is waited on like the region, since
 * it decides which guard applies.
 */
export const useTransferAccess = ({
  requestedDestination,
  isDrainConversion,
}: UseTransferAccessInput) => {
  const { card, isPending: isCardPending } = useTransferCard()
  const isCardHolder = card !== undefined

  const isGuardEnabled = !isDrainConversion && !isCardHolder && !isCardPending
  const dollarBalanceGuard = useDollarBalanceRestrictionGuard({ enabled: isGuardEnabled })
  const transferGuard = useTransferBlockedGuard({ enabled: isGuardEnabled })
  const dollarBalanceGate = useDollarBalanceGate()

  const isRefused = dollarBalanceGuard.isGated || transferGuard.isGated
  const isCardHolderDollarPending = isCardHolder && dollarBalanceGate.isRegionPending
  const isPending =
    dollarBalanceGuard.isRegionPending ||
    transferGuard.isRegionPending ||
    isCardHolderDollarPending ||
    isCardPending
  const isDollarBalanceOffered = !dollarBalanceGate.isGated || isDrainConversion
  /** A link that asks for the card without one opens the usual Transfer. */
  const isCardDestination = isCardHolder && requestedDestination === CARD
  const destination = isCardDestination ? CARD : undefined

  return { card, destination, isDollarBalanceOffered, isRefused, isPending }
}
