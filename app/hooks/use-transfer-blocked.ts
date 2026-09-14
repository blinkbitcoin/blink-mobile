import { useAccountRestrictions } from "./use-account-restrictions"
import { useSelfCustodialAccountMode } from "@app/self-custodial/hooks/use-self-custodial-account-mode"

/** `isGated` needs a resolved country, so it never ejects an allowed user. Surfaces hold
 *  on `isRegionPending` instead of reading the unresolved region as allowed, which is what
 *  the removed latch used to cover at launch. Anon resolves no region, so nothing pends
 *  there: the mode gates on its own. */
type TransferGate = {
  isGated: boolean
  isRegionPending: boolean
}

/** The availability gate: Anon gates transfers by itself, region otherwise. Availability
 *  surfaces and guards read this, the sole public gate. */
export const useTransferGate = (): TransferGate => {
  const { isAnonMode } = useSelfCustodialAccountMode()
  const { transfer, isSettled } = useAccountRestrictions()

  return { isGated: isAnonMode || transfer, isRegionPending: !isSettled }
}

export const useTransferGated = (): boolean => useTransferGate().isGated
