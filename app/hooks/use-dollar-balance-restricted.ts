import { AccountType } from "@app/types/wallet"

import { useAccountRestrictions } from "./use-account-restrictions"
import { useSelfCustodialAccountMode } from "@app/self-custodial/hooks/use-self-custodial-account-mode"

/** `isRestricted` needs a resolved country, so it never accuses an unrestricted user.
 *  Surfaces hold on `isRegionPending` instead of reading the unresolved region as
 *  unrestricted, which is what the removed latch used to cover at launch. */
type DollarBalanceRestriction = {
  isRestricted: boolean
  isRegionPending: boolean
  /** False when the restriction stands only because the region is unknown. */
  isRegionDetermined: boolean
}

/** Region policy only (false in Anon, where no region resolves). Availability surfaces
 *  must read useDollarBalanceGate instead. */
export const useDollarBalanceRestriction = (
  accountTypeOverride?: AccountType,
): DollarBalanceRestriction => {
  const { dollarBalance, isSettled, isRegionDetermined } =
    useAccountRestrictions(accountTypeOverride)

  return { isRestricted: dollarBalance, isRegionPending: !isSettled, isRegionDetermined }
}

type DollarBalanceGate = {
  isGated: boolean
  isRegionPending: boolean
}

/** The availability gate: Anon gates the dollar balance by itself, region otherwise. Anon
 *  resolves no region, so nothing pends there: the mode gates on its own. */
export const useDollarBalanceGate = (): DollarBalanceGate => {
  const { isAnonMode } = useSelfCustodialAccountMode()
  const { isRestricted, isRegionPending } = useDollarBalanceRestriction()

  return { isGated: isAnonMode || isRestricted, isRegionPending }
}

export const useDollarBalanceGated = (): boolean => useDollarBalanceGate().isGated
