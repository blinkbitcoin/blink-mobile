import { useCallback, useEffect, useState } from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { getSelfCustodialDefaultCurrency } from "@app/store/persistent-state/self-custodial-default-currency"

import { ReceiveAssetMode, ReceiveRail } from "../auto-convert"
import { useSelfCustodialWallet } from "../providers/wallet-provider"

/**
 * Pill represents the asset held after settlement. Stable-balance
 * active locks to Dollar (Breez sweeps); inactive falls back to the
 * user's Default account preference (Bitcoin or Dollar) from settings.
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

const resolveInitialMode = (
  isStableBalanceActive?: boolean,
  defaultCurrency?: "BTC" | "USD",
): ReceiveAssetMode => {
  if (isStableBalanceActive) return ReceiveAssetMode.Dollar
  if (defaultCurrency === WalletCurrency.Usd) return ReceiveAssetMode.Dollar
  return ReceiveAssetMode.Bitcoin
}

export const useReceiveAssetMode = (): UseReceiveAssetModeResult => {
  const { isStableBalanceActive } = useSelfCustodialWallet()
  const { persistentState } = usePersistentStateContext()
  const defaultCurrency = getSelfCustodialDefaultCurrency(persistentState)

  const [assetMode, setAssetMode] = useState<ReceiveAssetMode>(
    resolveInitialMode(isStableBalanceActive === true, defaultCurrency),
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
