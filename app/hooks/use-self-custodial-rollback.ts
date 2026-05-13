import { useEffect } from "react"

import { useFeatureFlags } from "@app/config/feature-flags-context"
import { AccountType, type AccountDescriptor } from "@app/types/wallet"

import { useHasCustodialAccount } from "./use-has-custodial-account"

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
  const { nonCustodialEnabled, remoteConfigReady } = useFeatureFlags()
  const hasCustodialAccount = useHasCustodialAccount()

  useEffect(() => {
    if (!remoteConfigReady) return
    if (nonCustodialEnabled) return
    if (activeAccount?.type !== AccountType.SelfCustodial) return

    const fallback = accounts.find((a) => a.type === AccountType.Custodial)
    if (!fallback) return

    setActiveAccountId(fallback.id)
  }, [
    remoteConfigReady,
    nonCustodialEnabled,
    activeAccount,
    accounts,
    setActiveAccountId,
  ])

  const isLockedOutOfSelfCustodial = remoteConfigReady && !nonCustodialEnabled

  const shouldShowUnavailable =
    isLockedOutOfSelfCustodial &&
    activeAccount?.type === AccountType.SelfCustodial &&
    !hasCustodialAccount

  return { shouldShowUnavailable }
}
