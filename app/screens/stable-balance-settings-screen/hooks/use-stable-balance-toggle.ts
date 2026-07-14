import { useCallback, useState } from "react"

import type { BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { useDollarBalanceRestricted } from "@app/hooks/use-dollar-balance-restricted"
import { logSelfCustodialStableBalanceActivated } from "@app/self-custodial/analytics"
import { activateStableBalance } from "@app/self-custodial/bridge"
import { SparkToken } from "@app/self-custodial/config"
import { deactivateStableBalanceAndRefresh } from "@app/self-custodial/stable-balance"
import type { TranslationFunctions } from "@app/i18n/i18n-types"
import { reportError } from "@app/utils/error-logging"
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
  const isDollarBalanceRestricted = useDollarBalanceRestricted()
  const [busy, setBusy] = useState(false)
  const [pendingValue, setPendingValue] = useState<boolean | null>(null)
  const [switchKey, setSwitchKey] = useState(0)

  const resyncSwitch = useCallback(() => setSwitchKey((k) => k + 1), [])

  const apply = useCallback(
    async (activate: boolean) => {
      if (!sdk || busy) return

      /** Activation is region-gated or a restricted user could loop fee-paying
       *  conversions: activate, auto-convert to the token, get force-converted back.
       *  Deactivation stays allowed so an already-active balance can be freed. */
      const isActivationBlocked = activate && isDollarBalanceRestricted
      if (isActivationBlocked) {
        toastShow({
          message: (tr) => tr.DollarBalanceRestriction.modalTitle(),
          LL,
          type: "error",
        })
        resyncSwitch()
        return
      }
      setBusy(true)
      setPendingValue(activate)
      try {
        if (activate) {
          await activateStableBalance(sdk, SparkToken.Label)
          logSelfCustodialStableBalanceActivated({ label: SparkToken.Label })
          await refreshStableBalanceActive()
          await refreshWallets()
        } else {
          const deactivated = await deactivateStableBalanceAndRefresh({
            sdk,
            refreshWallets,
            refreshStableBalanceActive,
            LL,
          })
          if (!deactivated) resyncSwitch()
        }
      } catch (err) {
        reportError("Stable Balance toggle", err)
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
    [
      sdk,
      busy,
      isDollarBalanceRestricted,
      refreshStableBalanceActive,
      refreshWallets,
      LL,
      resyncSwitch,
    ],
  )

  return {
    busy,
    displayValue: pendingValue ?? isStableBalanceActive,
    switchKey,
    apply,
    resyncSwitch,
  }
}
