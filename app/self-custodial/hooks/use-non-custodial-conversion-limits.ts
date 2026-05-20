import { useEffect, useState } from "react"

import { fetchConversionLimits } from "@app/self-custodial/bridge"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import { type ConversionLimits, type ConvertDirection } from "@app/types/payment.types"

type Result = {
  limits: ConversionLimits | null
  loading: boolean
  error: Error | null
}

export const useNonCustodialConversionLimits = (
  direction: ConvertDirection | undefined,
): Result => {
  const { sdk } = useSelfCustodialWallet()
  const [limits, setLimits] = useState<ConversionLimits | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!sdk || !direction) {
      setLimits(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchConversionLimits(sdk, direction)
      .then((result) => {
        if (!cancelled) setLimits(result)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
        setLimits(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sdk, direction])

  return { limits, loading, error }
}
