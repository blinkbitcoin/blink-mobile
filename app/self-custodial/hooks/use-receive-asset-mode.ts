import { useCallback, useEffect, useState } from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { useStablesatsRestricted } from "@app/hooks/use-stablesats-restricted"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { getSelfCustodialDefaultCurrency } from "@app/store/persistent-state/self-custodial-default-currency"

import { ReceiveAssetMode, ReceiveRail } from "../auto-convert"
import { useSelfCustodialWallet } from "../providers/wallet"

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
  isStableBalanceActive: boolean | undefined,
  defaultCurrency: "BTC" | "USD" | undefined,
  isStablesatsRestricted: boolean,
): ReceiveAssetMode => {
  if (isStablesatsRestricted) return ReceiveAssetMode.Bitcoin
  if (isStableBalanceActive) return ReceiveAssetMode.Dollar
  if (defaultCurrency === WalletCurrency.Usd) return ReceiveAssetMode.Dollar
  return ReceiveAssetMode.Bitcoin
}

export const useReceiveAssetMode = (): UseReceiveAssetModeResult => {
  const { isStableBalanceActive } = useSelfCustodialWallet()
  const { persistentState } = usePersistentStateContext()
  const defaultCurrency = getSelfCustodialDefaultCurrency(persistentState)
  const isStablesatsRestricted = useStablesatsRestricted()

  const [assetMode, setAssetMode] = useState<ReceiveAssetMode>(
    resolveInitialMode(
      isStableBalanceActive === true,
      defaultCurrency,
      isStablesatsRestricted,
    ),
  )

  // Re-align to Dollar when stable balance becomes active (but only if not restricted).
  useEffect(() => {
    if (isStablesatsRestricted) return
    if (isStableBalanceActive && assetMode !== ReceiveAssetMode.Dollar) {
      setAssetMode(ReceiveAssetMode.Dollar)
    }
  }, [isStableBalanceActive, assetMode, isStablesatsRestricted])

  // Re-align to Bitcoin if the restriction becomes active after the initial mount.
  useEffect(() => {
    if (isStablesatsRestricted && assetMode !== ReceiveAssetMode.Bitcoin) {
      setAssetMode(ReceiveAssetMode.Bitcoin)
    }
  }, [isStablesatsRestricted, assetMode])

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
