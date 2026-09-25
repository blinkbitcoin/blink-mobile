import React from "react"

import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { SELF_CUSTODIAL_BLOCKED_STATUSES } from "@app/types/wallet"

import { PaymentOfflineNotice } from "./payment-offline-notice"

type Props = {
  children: React.ReactNode
}

export const OfflineGate: React.FC<Props> = ({ children }) => {
  const { isSelfCustodial, status } = useActiveWallet()
  if (isSelfCustodial && SELF_CUSTODIAL_BLOCKED_STATUSES.includes(status)) {
    return <PaymentOfflineNotice />
  }
  return <>{children}</>
}
