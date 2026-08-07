import React, { useEffect } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useFeatureFlags } from "@app/config/feature-flags-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  useMigrationCheckpoint,
  useSelfCustodialDisabled,
} from "@app/screens/account-migration/hooks"
import { AccountType } from "@app/types/wallet"

/** The single dispatcher for every migration entry: the deeplink (blink://account-migration),
 *  the Settings row and the home bulletin all route here, so this is the one place that
 *  decides resume-vs-fresh. Enforcing the kill-switch here keeps any entry point from leaking
 *  a resume past the choke point. It replaces itself so it never stays in the stack. */
export const MigrationEntryScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { activeAccount, loading: registryLoading } = useAccountRegistry()
  const { loading, replaceToCheckpoint, hasResumableCheckpoint } =
    useMigrationCheckpoint()
  const isSelfCustodialDisabled = useSelfCustodialDisabled()
  const { remoteConfigReady } = useFeatureFlags()

  const isSelfCustodialAccount = activeAccount?.type === AccountType.SelfCustodial

  /** The kill-switch outranks resume: a disabled stack falls through to the gate (which shows
   *  the temporarily-unavailable screen) instead of resuming a checkpoint straight past it. */
  const shouldResume = !isSelfCustodialDisabled && hasResumableCheckpoint

  useEffect(() => {
    /** Wait for the account list and the flag too, not just the checkpoint: an unhydrated
     *  registry reads as non-self-custodial (bouncing an SC user into the custodial gate),
     *  and an unresolved flag reads as enabled (slipping a resume past a disabled stack). */
    if (loading || registryLoading || !remoteConfigReady) return

    if (isSelfCustodialAccount) {
      if (navigation.canGoBack()) {
        navigation.goBack()
        return
      }
      navigation.replace("Primary")
      return
    }

    if (shouldResume) {
      replaceToCheckpoint()
      return
    }

    navigation.replace("accountMigrationStart")
  }, [
    loading,
    registryLoading,
    remoteConfigReady,
    isSelfCustodialAccount,
    shouldResume,
    replaceToCheckpoint,
    navigation,
  ])

  return null
}
