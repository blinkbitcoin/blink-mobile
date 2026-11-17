import { GateReason } from "@app/types/account"

import { toGateReason, useAccountRestrictions } from "./use-account-restrictions"
import { useSelfCustodialAccountMode } from "@app/self-custodial/hooks/use-self-custodial-account-mode"

/** `isGated` needs a resolved country, so it never ejects an allowed user. Surfaces hold
 *  on `isRegionPending` instead of reading the unresolved region as allowed, which is what
 *  the removed latch used to cover at launch. Anon resolves no region, so nothing pends
 *  there: the mode gates on its own. */
type TransferGate = {
  isGated: boolean
  isRegionPending: boolean
  /** Why the gate is closed, null while it is open. No transfer surface renders copy from
   *  it yet (the guard resets navigation instead); it is here so both gates answer alike. */
  reason: GateReason | null
}

/** The availability gate: Anon gates transfers by itself, region otherwise. Availability
 *  surfaces and guards read this, the sole public gate. */
export const useTransferGate = (): TransferGate => {
  const { isAnonMode } = useSelfCustodialAccountMode()
  const { transfer, isSettled, isRegionDetermined } = useAccountRestrictions()

  return {
    isGated: isAnonMode || transfer,
    isRegionPending: !isSettled,
    reason: toGateReason({ isAnonMode, isRestricted: transfer, isRegionDetermined }),
  }
}

export const useTransferGated = (): boolean => useTransferGate().isGated
