import type { BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import type { TranslationFunctions } from "@app/i18n/i18n-types"
import { reportError } from "@app/utils/error-logging"
import { toastShow } from "@app/utils/toast"

import { deactivateStableBalance } from "./bridge"

type DeactivateStableBalanceAndRefreshParams = {
  sdk: BreezSdkInterface
  refreshWallets: () => Promise<void>
  refreshStableBalanceActive: () => Promise<void>
  LL: TranslationFunctions
}

/**
 * Single "switch Stable Balance off and refresh" routine shared by the settings
 * toggle and the forced-conversion modal. A failed deactivation is reported and
 * toasted, but the refresh still runs: the caller may have just moved funds, so
 * the balances changed regardless. A failed refresh is only reported, because
 * the state refetches later anyway. Returns whether the deactivation succeeded
 * so callers can resync their UI.
 */
export const deactivateStableBalanceAndRefresh = async ({
  sdk,
  refreshWallets,
  refreshStableBalanceActive,
  LL,
}: DeactivateStableBalanceAndRefreshParams): Promise<boolean> => {
  const deactivated = await deactivateStableBalance(sdk).then(
    () => true,
    (err) => {
      reportError("Stable Balance deactivate", err)
      toastShow({
        message: (tr) => tr.StableBalance.toggleFailedToast(),
        LL,
        type: "error",
      })
      return false
    },
  )
  await Promise.all([refreshStableBalanceActive(), refreshWallets()]).catch((err) =>
    reportError("Stable Balance refresh", err),
  )
  return deactivated
}
