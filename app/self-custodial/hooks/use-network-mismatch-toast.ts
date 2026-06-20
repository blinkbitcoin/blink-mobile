import { useEffect, useRef } from "react"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { AccountType } from "@app/types/wallet"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { toastShow } from "@app/utils/toast"

import { mismatchedNetworkLabel } from "../config"

import { useSparkNetwork } from "./use-spark-network"

/**
 * A self-custodial account is bound to the network it was created on, so it
 * cannot connect while the environment runs a different network. This surfaces
 * a one-time toast naming the network to switch back to, instead of leaving the
 * user on a silently stuck wallet.
 */
export const useSelfCustodialNetworkMismatchToast = (): void => {
  const { LL } = useI18nContext()
  const { activeAccount } = useAccountRegistry()
  const network = useSparkNetwork()
  const notifiedKeyRef = useRef<string | null>(null)

  const accountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null

  useEffect(() => {
    if (!accountId) {
      notifiedKeyRef.current = null
      return undefined
    }

    let cancelled = false

    const notifyOnMismatch = async () => {
      const storedNetwork = await KeyStoreWrapper.getMnemonicNetworkForAccount(accountId)
      if (cancelled) return
      const walletNetwork = mismatchedNetworkLabel(storedNetwork, network)
      if (!walletNetwork) {
        notifiedKeyRef.current = null
        return
      }
      const notifiedKey = `${accountId}:${walletNetwork}`
      if (notifiedKeyRef.current === notifiedKey) return
      notifiedKeyRef.current = notifiedKey
      toastShow({
        type: "error",
        message: LL.SelfCustodialNetworkMismatch.toast({ network: walletNetwork }),
        LL,
      })
    }

    notifyOnMismatch()

    return () => {
      cancelled = true
    }
  }, [accountId, network, LL])
}
