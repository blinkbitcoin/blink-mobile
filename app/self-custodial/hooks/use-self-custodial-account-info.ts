import { useEffect, useState } from "react"

import { getLightningAddress, getWalletInfo } from "@app/self-custodial/bridge"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"

type AccountInfo = {
  identityPubkey: string
  lightningAddress: string | null
  loading: boolean
  error: Error | null
}

const initialInfo: AccountInfo = {
  identityPubkey: "",
  lightningAddress: null,
  loading: true,
  error: null,
}

export const useSelfCustodialAccountInfo = (): AccountInfo => {
  const { sdk } = useSelfCustodialWallet()
  const [info, setInfo] = useState<AccountInfo>(initialInfo)

  useEffect(() => {
    if (!sdk) return

    let mounted = true
    const load = async () => {
      try {
        const [walletInfo, lnAddressInfo] = await Promise.all([
          getWalletInfo(sdk),
          getLightningAddress(sdk).catch(() => undefined),
        ])
        if (!mounted) return
        setInfo({
          identityPubkey: walletInfo.identityPubkey,
          lightningAddress: lnAddressInfo?.lightningAddress ?? null,
          loading: false,
          error: null,
        })
      } catch (err) {
        if (!mounted) return
        setInfo({
          identityPubkey: "",
          lightningAddress: null,
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        })
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [sdk])

  return info
}
