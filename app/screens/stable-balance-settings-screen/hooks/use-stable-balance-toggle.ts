import { useCallback, useState } from "react"

import type { BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"

import {
  activateStableBalance,
  deactivateStableBalance,
} from "@app/self-custodial/bridge"
import { SparkToken } from "@app/self-custodial/config"
import type { TranslationFunctions } from "@app/i18n/i18n-types"
import { logSelfCustodialStableBalanceActivated } from "@app/utils/analytics"
import { toastShow } from "@app/utils/toast"

type Params = {
  sdk: BreezSdkInterface | null
  isStableBalanceActive: boolean
  refreshWallets: () => Promise<void>
  refreshStableBalanceActive: () => Promise<void>
  LL: TranslationFunctions
}

export type StableBalanceToggleControls = {
  busy: boolean
  displayValue: boolean
  switchKey: number
  apply: (activate: boolean) => Promise<void>
  resyncSwitch: () => void
}

export const useStableBalanceToggle = ({
  sdk,
  isStableBalanceActive,
  refreshWallets,
  refreshStableBalanceActive,
  LL,
}: Params): StableBalanceToggleControls => {
  const [busy, setBusy] = useState(false)
  const [pendingValue, setPendingValue] = useState<boolean | null>(null)
  const [switchKey, setSwitchKey] = useState(0)

  const resyncSwitch = useCallback(() => setSwitchKey((k) => k + 1), [])

  const apply = useCallback(
    async (activate: boolean) => {
      if (!sdk || busy) return
      setBusy(true)
      setPendingValue(activate)
      try {
        if (activate) {
          await activateStableBalance(sdk, SparkToken.Label)
          logSelfCustodialStableBalanceActivated({ label: SparkToken.Label })
        } else {
          await deactivateStableBalance(sdk)
        }
        await refreshStableBalanceActive()
        await refreshWallets()
      } catch (err) {
        crashlytics().recordError(
          err instanceof Error ? err : new Error(`Stable Balance toggle failed: ${err}`),
        )
        toastShow({
          message: (tr) => tr.StableBalance.toggleFailedToast(),
          LL,
          type: "error",
        })
        resyncSwitch()
      } finally {
        setBusy(false)
        setPendingValue(null)
      }
    },
    [sdk, busy, refreshStableBalanceActive, refreshWallets, LL, resyncSwitch],
  )

  return {
    busy,
    displayValue: pendingValue ?? isStableBalanceActive,
    switchKey,
    apply,
    resyncSwitch,
  }
}
