import React from "react"

import { SelfCustodialPaymentOfflineNotice } from "@app/components/self-custodial-payment-offline-notice"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { ActiveWalletStatus } from "@app/types/wallet"

type Props = {
  children: React.ReactNode
}

const SC_BLOCKED_STATUSES: readonly ActiveWalletStatus[] = [
  ActiveWalletStatus.Offline,
  ActiveWalletStatus.Error,
  ActiveWalletStatus.Unavailable,
]

export const OfflineGate: React.FC<Props> = ({ children }) => {
  const { isSelfCustodial, status } = useActiveWallet()
  if (isSelfCustodial && SC_BLOCKED_STATUSES.includes(status)) {
    return <SelfCustodialPaymentOfflineNotice />
  }
  return <>{children}</>
}
