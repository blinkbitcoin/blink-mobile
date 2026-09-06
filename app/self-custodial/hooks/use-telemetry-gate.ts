import { useEffect } from "react"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { AccountMode } from "@app/types/account"
import { AccountType } from "@app/types/wallet"

import { resolveTelemetryMode, TelemetryMode } from "../measurement/gate"

import { useSelfCustodialAccountMode } from "./use-self-custodial-account-mode"

/**
 * Drives the collection gate off the active account.
 *
 * A self-custodial account whose mode is **unset** resolves to `Unresolved`, not
 * `Enhanced`. This deliberately diverges from the UI, which reads an unset mode as
 * Enhanced so the settings row has something to show: §5.7 asks for a *positive*
 * resolution, and "we never asked, so we assumed consent" is not one. Such an account
 * stays silent until `useAccountModeSync` recovers its real mode from the LNURL server,
 * at which point this resolves for real.
 *
 * Switching accounts re-runs this, so the gate follows whichever account is active rather
 * than latching on the first one seen.
 */
export const useTelemetryGate = (): void => {
  const { activeAccount } = useAccountRegistry()
  const { accountMode } = useSelfCustodialAccountMode()

  const accountType = activeAccount?.type

  useEffect(() => {
    if (accountType === AccountType.Custodial) {
      resolveTelemetryMode(TelemetryMode.Custodial)
      return
    }

    if (accountType === AccountType.SelfCustodial) {
      if (accountMode === AccountMode.Enhanced) {
        resolveTelemetryMode(TelemetryMode.Enhanced)
        return
      }
      if (accountMode === AccountMode.Anon) {
        resolveTelemetryMode(TelemetryMode.Incognito)
        return
      }
    }

    /** No account, or a self-custodial account that has not positively resolved a mode.
     *  Silence is the safe state (FR-6). */
    resolveTelemetryMode(TelemetryMode.Unresolved)
  }, [accountType, accountMode])
}
