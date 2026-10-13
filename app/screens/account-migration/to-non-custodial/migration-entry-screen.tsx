import React, { useEffect } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useFeatureFlags } from "@app/config/feature-flags-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  useMigrationCheckpoint,
  useSelfCustodialDisabled,
} from "@app/screens/account-migration/hooks"
import { useMigrationLock } from "@app/screens/account-migration/hooks/use-migration-lock"
import { resolveCommitPointRoute } from "@app/screens/account-migration/utils/migration-checkpoint-storage"
import {
  isMigrationReceiveSupportDue,
  OVERDUE_RECEIVE_SUPPORT,
} from "@app/screens/account-migration/utils/migration-receive-wait"
import { CommitPointRoute } from "@app/types/migration"
import { AccountType } from "@app/types/wallet"
import { toastShow } from "@app/utils/toast"

/** The single dispatcher for every migration entry: the deeplink (blink://account-migration),
 *  the Settings row and the home bulletin all route here, so this is the one place that
 *  decides resume-vs-fresh. Enforcing the kill-switch here keeps any entry point from leaking
 *  a resume past the choke point. It replaces itself so it never stays in the stack. */
export const MigrationEntryScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { activeAccount, loading: registryLoading } = useAccountRegistry()
  const { loading, replaceToCheckpoint, isAtCommitPoint, isStartConfirmed } =
    useMigrationCheckpoint()
  const { flow, loading: lockLoading } = useMigrationLock()
  const { LL } = useI18nContext()
  const isSelfCustodialDisabled = useSelfCustodialDisabled()
  const { remoteConfigReady } = useFeatureFlags()

  const isSelfCustodialAccount = activeAccount?.type === AccountType.SelfCustodial

  /** Only the commit point resumes (#4109): a flow left before it restarts at the gate, so
   *  reopening replays the whole thing from its first step instead of dropping the user
   *  into a backup screen they have no context for. The kill-switch outranks even that: a
   *  disabled stack falls through to the gate, which shows the unavailable screen.
   *
   *  And only on the server's word, read through the same rule the flow's steps follow.
   *  The checkpoint records which screen the device left off on, never whether that is
   *  still where the user belongs:
   *  - resume when the flow is open, or never started (the commit screen starts it, as a
   *    conversion that emptied the dollar balance returns here to do);
   *  - await the swap when the funds already moved and this device is finishing on its
   *    own: leave the flow alone. Resuming would ask the server to start a migration it
   *    already finished and hand the user to support; the gate would walk them into a new
   *    run that drops the figure the swap waits on;
   *  - anything else goes to the gate: a flow support cleared starts over there, and an
   *    unanswered read blocks there with a retry. */
  const commitPointRoute = resolveCommitPointRoute(flow, isStartConfirmed)
  const isCommitPointActive = !isSelfCustodialDisabled && isAtCommitPoint
  const isResumeRoute = commitPointRoute === CommitPointRoute.Resume
  const isAwaitSwapRoute = commitPointRoute === CommitPointRoute.AwaitSwap
  const shouldResume = isCommitPointActive && isResumeRoute
  const isAwaitingSwap = isCommitPointActive && isAwaitSwapRoute

  useEffect(() => {
    /** Wait for the account list and the flag too, not just the checkpoint: an unhydrated
     *  registry reads as non-self-custodial (bouncing an SC user into the custodial gate),
     *  and an unresolved flag reads as enabled (slipping a resume past a disabled stack). */
    if (loading || registryLoading || lockLoading || !remoteConfigReady) return

    /** This screen renders nothing, so leaving it goes back to wherever the entry came
     *  from, or home when there is nothing to go back to. */
    const leave = (): void => {
      if (navigation.canGoBack()) {
        navigation.goBack()
        return
      }
      navigation.replace("Primary")
    }

    if (isSelfCustodialAccount) {
      leave()
      return
    }

    if (isAwaitingSwap) {
      /** Past the notice window, and with the app back long enough for a fresh check to
       *  have cleared it, the funds are genuinely late: support, not another "on its
       *  way". */
      if (isMigrationReceiveSupportDue()) {
        navigation.replace("accountMigrationContactSupport", OVERDUE_RECEIVE_SUPPORT)
        return
      }
      toastShow({
        message: LL.AccountMigration.transferDelayed.body(),
        LL,
        type: "warning",
      })
      leave()
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
    lockLoading,
    remoteConfigReady,
    isSelfCustodialAccount,
    isAwaitingSwap,
    shouldResume,
    replaceToCheckpoint,
    navigation,
    LL,
  ])

  return null
}
