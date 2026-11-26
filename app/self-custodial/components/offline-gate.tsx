import React from "react"

import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { SELF_CUSTODIAL_BLOCKED_STATUSES } from "@app/types/wallet"

import { PaymentOfflineNotice } from "./payment-offline-notice"

type Props = {
  children: React.ReactNode
  /** A settled send sets this so a later offline refresh cannot unmount the receipt
   *  handoff. Other screens leave it unset and keep today's block. */
  bypass?: boolean
}

export const OfflineGate: React.FC<Props> = ({ children, bypass = false }) => {
  const { isSelfCustodial, status } = useActiveWallet()
  if (!bypass && isSelfCustodial && SELF_CUSTODIAL_BLOCKED_STATUSES.includes(status)) {
    return <PaymentOfflineNotice />
  }
  return <>{children}</>
}
