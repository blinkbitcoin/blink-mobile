import { useEffect, useState } from "react"

import { fetchConversionLimits } from "@app/self-custodial/bridge"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { type ConversionLimits, type ConvertDirection } from "@app/types/payment"
import { AccountType } from "@app/types/wallet"

import { useAccountRegistry } from "./use-account-registry"

type Result = {
  limits: ConversionLimits | null
  loading: boolean
  error: Error | null
}

const NO_LIMITS: ConversionLimits = { minFromAmount: null, minToAmount: null }

export const useConversionLimits = (direction: ConvertDirection | undefined): Result => {
  const { activeAccount } = useAccountRegistry()
  const { sdk } = useSelfCustodialWallet()
  const accountType = activeAccount?.type

  const [limits, setLimits] = useState<ConversionLimits | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (accountType !== AccountType.SelfCustodial) {
      setLimits(NO_LIMITS)
      setLoading(false)
      setError(null)
      return
    }
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
  }, [accountType, sdk, direction])

  return { limits, loading, error }
}
