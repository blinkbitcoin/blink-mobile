import { useEffect, useState } from "react"

import { fetchConversionLimits } from "@app/self-custodial/bridge"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import { ConvertDirection, type ConversionLimits } from "@app/types/payment.types"

type ConversionLimitsState = {
  btcToUsd: ConversionLimits | null
  usdToBtc: ConversionLimits | null
  loading: boolean
  error: Error | null
}

const initialState: ConversionLimitsState = {
  btcToUsd: null,
  usdToBtc: null,
  loading: true,
  error: null,
}

export const useSelfCustodialConversionLimits = (): ConversionLimitsState => {
  const { sdk } = useSelfCustodialWallet()
  const [state, setState] = useState<ConversionLimitsState>(initialState)

  useEffect(() => {
    if (!sdk) return

    let mounted = true
    const load = async () => {
      try {
        const [btcToUsd, usdToBtc] = await Promise.all([
          fetchConversionLimits(sdk, ConvertDirection.BtcToUsd),
          fetchConversionLimits(sdk, ConvertDirection.UsdToBtc),
        ])
        if (!mounted) return
        setState({ btcToUsd, usdToBtc, loading: false, error: null })
      } catch (err) {
        if (!mounted) return
        setState({
          btcToUsd: null,
          usdToBtc: null,
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

  return state
}
