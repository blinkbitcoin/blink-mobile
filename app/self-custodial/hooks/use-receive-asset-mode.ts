import { useCallback, useEffect, useState } from "react"

import { ReceiveAssetMode, ReceiveRail } from "../auto-convert"
import { useSelfCustodialWallet } from "../providers/wallet-provider"

/**
 * Pill represents the asset held after settlement. Stable-balance
 * active locks to Dollar (Breez sweeps); inactive defaults to Bitcoin
 * with Dollar as opt-in for our client-side convert.
 */

export type UseReceiveAssetModeResult = {
  assetMode: ReceiveAssetMode
  setAssetMode: (mode: ReceiveAssetMode) => void
  isToggleDisabled: boolean
  availableModesForRail: (rail: ReceiveRail) => readonly ReceiveAssetMode[]
  loading: boolean
}

const ALL_MODES = [ReceiveAssetMode.Bitcoin, ReceiveAssetMode.Dollar] as const
const BITCOIN_ONLY = [ReceiveAssetMode.Bitcoin] as const
const DOLLAR_ONLY = [ReceiveAssetMode.Dollar] as const

export const useReceiveAssetMode = (): UseReceiveAssetModeResult => {
  const { isStableBalanceActive } = useSelfCustodialWallet()

  const [assetMode, setAssetMode] = useState<ReceiveAssetMode>(
    isStableBalanceActive ? ReceiveAssetMode.Dollar : ReceiveAssetMode.Bitcoin,
  )

  // Re-align to Dollar when stable balance becomes active.
  useEffect(() => {
    if (isStableBalanceActive && assetMode !== ReceiveAssetMode.Dollar) {
      setAssetMode(ReceiveAssetMode.Dollar)
    }
  }, [isStableBalanceActive, assetMode])

  const availableModesForRail = useCallback(
    (rail: ReceiveRail): readonly ReceiveAssetMode[] => {
      if (rail === ReceiveRail.Onchain) return BITCOIN_ONLY
      if (isStableBalanceActive) return DOLLAR_ONLY
      return ALL_MODES
    },
    [isStableBalanceActive],
  )

  return {
    assetMode,
    setAssetMode,
    isToggleDisabled: Boolean(isStableBalanceActive),
    availableModesForRail,
    loading: isStableBalanceActive === undefined,
  }
}
