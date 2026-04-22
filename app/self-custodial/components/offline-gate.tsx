import React from "react"

import { SelfCustodialPaymentOfflineNotice } from "@app/components/self-custodial-payment-offline-notice"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { ActiveWalletStatus } from "@app/types/wallet.types"

type Props = {
  children: React.ReactNode
}

export const OfflineGate: React.FC<Props> = ({ children }) => {
  const { isSelfCustodial, status } = useActiveWallet()
  if (isSelfCustodial && status === ActiveWalletStatus.Offline) {
    return <SelfCustodialPaymentOfflineNotice />
  }
  return <>{children}</>
}
