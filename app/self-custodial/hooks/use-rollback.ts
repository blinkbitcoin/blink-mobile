import { useEffect } from "react"

import { useFeatureFlags } from "@app/config/feature-flags-context"
import { AccountType, type AccountDescriptor } from "@app/types/wallet"
import { useHasCustodialAccount } from "@app/hooks/use-has-custodial-account"

type RollbackDeps = {
  activeAccount?: AccountDescriptor
  accounts: AccountDescriptor[]
  setActiveAccountId: (id: string) => void
}

type RollbackResult = {
  shouldShowUnavailable: boolean
}

export const useSelfCustodialRollback = ({
  activeAccount,
  accounts,
  setActiveAccountId,
}: RollbackDeps): RollbackResult => {
  const { nonCustodialEnabled, remoteConfigReady, remoteConfigTrusted } =
    useFeatureFlags()
  const hasCustodialAccount = useHasCustodialAccount()

  useEffect(() => {
    /**
     * A *successful* fetch that positively disables self-custody, never a default read as
     * an answer. `remoteConfigReady` is set in a `finally` regardless of whether the fetch
     * threw, and `nonCustodialEnabled` defaults to `false`, so gating on readiness alone
     * bounced a self-custodial user to custodial on any network blip — and, downstream of
     * that, turned full analytics collection on for someone who last chose incognito.
     */
    if (!remoteConfigTrusted) return
    if (!remoteConfigReady) return
    if (nonCustodialEnabled) return
    if (activeAccount?.type !== AccountType.SelfCustodial) return

    const fallback = accounts.find((a) => a.type === AccountType.Custodial)
    if (!fallback) return

    setActiveAccountId(fallback.id)
  }, [
    remoteConfigTrusted,
    remoteConfigReady,
    nonCustodialEnabled,
    activeAccount,
    accounts,
    setActiveAccountId,
  ])

  const isLockedOutOfSelfCustodial =
    remoteConfigTrusted && remoteConfigReady && !nonCustodialEnabled

  const shouldShowUnavailable =
    isLockedOutOfSelfCustodial &&
    activeAccount?.type === AccountType.SelfCustodial &&
    !hasCustodialAccount

  return { shouldShowUnavailable }
}
