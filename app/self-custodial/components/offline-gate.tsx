import React from "react"

import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { ActiveWalletStatus } from "@app/types/wallet"

import { PaymentOfflineNotice } from "./payment-offline-notice"

type Props = {
  children: React.ReactNode
}

const SELF_CUSTODIAL_BLOCKED_STATUSES: readonly ActiveWalletStatus[] = [
  ActiveWalletStatus.Offline,
  ActiveWalletStatus.Error,
  ActiveWalletStatus.Unavailable,
]

export const OfflineGate: React.FC<Props> = ({ children }) => {
  const { isSelfCustodial, status } = useActiveWallet()
  if (isSelfCustodial && SELF_CUSTODIAL_BLOCKED_STATUSES.includes(status)) {
    return <PaymentOfflineNotice />
  }
  return <>{children}</>
}
