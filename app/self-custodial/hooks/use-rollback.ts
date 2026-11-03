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
  const { nonCustodialEnabled, remoteConfigReady, isNonCustodialFlagSettled } =
    useFeatureFlags()
  const hasCustodialAccount = useHasCustodialAccount()
  /** Only the console's word closes the wallet: the shipped default offers self-custodial
   *  to a device the console never reached, so that device must not lock the user out of
   *  the wallet onboarding just gave them, nor move them to custodial on every launch. */
  const isDisabledByConsole = isNonCustodialFlagSettled && !nonCustodialEnabled

  useEffect(() => {
    if (!remoteConfigReady) return
    if (!isDisabledByConsole) return
    if (activeAccount?.type !== AccountType.SelfCustodial) return

    const fallback = accounts.find((a) => a.type === AccountType.Custodial)
    if (!fallback) return

    setActiveAccountId(fallback.id)
  }, [
    remoteConfigReady,
    isDisabledByConsole,
    activeAccount,
    accounts,
    setActiveAccountId,
  ])

  const isLockedOutOfSelfCustodial = remoteConfigReady && isDisabledByConsole

  const shouldShowUnavailable =
    isLockedOutOfSelfCustodial &&
    activeAccount?.type === AccountType.SelfCustodial &&
    !hasCustodialAccount

  return { shouldShowUnavailable }
}
