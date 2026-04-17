import React from "react"

import { ScPaymentOfflineNotice } from "@app/components/sc-payment-offline-notice"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { ActiveWalletStatus } from "@app/types/wallet.types"

const cache = new WeakMap<object, React.FC<object>>()

export const withOfflineGate = <P extends object>(Component: React.ComponentType<P>) => {
  const cached = cache.get(Component) as React.FC<P> | undefined
  if (cached) return cached

  const Gated: React.FC<P> = (props) => {
    const { isSelfCustodial, status } = useActiveWallet()
    if (isSelfCustodial && status === ActiveWalletStatus.Offline) {
      return <ScPaymentOfflineNotice />
    }
    return <Component {...props} />
  }
  Gated.displayName = `WithOfflineGate(${
    Component.displayName ?? Component.name ?? "Component"
  })`
  cache.set(Component, Gated as React.FC<object>)
  return Gated
}
