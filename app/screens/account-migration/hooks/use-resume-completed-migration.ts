import { useEffect, useRef, useState } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { MigrationStatus } from "@app/graphql/generated"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { MigrationSupportOrigin, MigrationSupportReason } from "@app/types/migration"
import { reportError } from "@app/utils/error-logging"

import { useCompleteMigration } from "./use-complete-migration"
import { useMigrationReceiveConfirmation } from "./use-migration-receive-confirmation"
import { useMigrationStatus } from "./use-migration-status"

/** A transient swap failure (a briefly locked keystore) can clear on a retry, so a few
 *  are attempted before leaving the rest to the next launch, which starts the count over. */
const MAX_SWAP_ATTEMPTS = 3

/**
 * Finishes a migration the server completed but this device never swapped away from. The
 * transfer ends in two steps, the server moving the funds and the app switching sessions,
 * and only the transfer screen watches for the first. An app killed between them would
 * otherwise open on the emptied custodial account with the funded wallet sitting unused
 * in the switcher, at the worst possible moment for the user to be told nothing. The
 * server is only asked when a checkpoint says this device has a migration to finish, so
 * nobody else pays for a question they cannot act on.
 */
export const useResumeCompletedMigration = (): void => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const {
    migrationCheckpoint,
    migrationAccountId,
    migrationExpectedReceiveSats,
    migrationLoading,
    completeMigration,
    saveCheckpoint,
  } = useCompleteMigration()

  /**
   * The checkpoint expires 48h after its last write, and the receive gate below has no
   * bound at all, so a receive that stays unconfirmed for two days would have the record it
   * depends on deleted underneath it — leaving the provisioned wallet funded, hidden from
   * the switcher by a pending record that never expires, and no longer resumable. Rewriting
   * it once per launch keeps the two lifetimes in step, and costs a single storage write on
   * the launches where a migration is genuinely unfinished. The step is re-sent unchanged
   * and carries no fresh figure, so nothing but `savedAt` moves.
   */
  const hasRefreshedCheckpointRef = useRef(false)
  useEffect(() => {
    if (!migrationCheckpoint || migrationLoading || hasRefreshedCheckpointRef.current) {
      return
    }
    hasRefreshedCheckpointRef.current = true
    saveCheckpoint(migrationCheckpoint)
  }, [migrationCheckpoint, migrationLoading, saveCheckpoint])

  const hasUnfinishedMigration = Boolean(migrationAccountId)
  const { status } = useMigrationStatus({ skip: !hasUnfinishedMigration })

  const [attempts, setAttempts] = useState(0)
  const isSwapInFlightRef = useRef(false)

  const isServerCompleted =
    status === MigrationStatus.Completed && hasUnfinishedMigration && !migrationLoading

  /** The same receive gate as the transfer screen: a relaunch mid-transfer must not swap
   *  into a wallet whose funds are still in transit either (#4102). Unconfirmed simply
   *  means no swap this session — the custodial session stays intact and the next launch
   *  (or this one, once a check lands) picks the swap back up. */
  const { isReceiveConfirmed, isReceiveDelayed, isReceiveUnrecoverable } =
    useMigrationReceiveConfirmation({
      selfCustodialAccountId: migrationAccountId,
      expectedReceiveSats: migrationExpectedReceiveSats,
      skip: !isServerCompleted,
    })

  /** This path has no screen of its own to say the wait is unusual, so the crossing is at
   *  least reported: a receive that never lands would otherwise be invisible, the user
   *  sitting on a normal home with nothing pending anywhere. */
  const hasReportedDelayRef = useRef(false)
  useEffect(() => {
    if (!isReceiveDelayed || hasReportedDelayRef.current) return
    hasReportedDelayRef.current = true
    reportError(
      "Migration resume receive delayed",
      new Error("Receive has not landed within the notice window"),
    )
  }, [isReceiveDelayed])

  /** A swap that resolves false is terminal, not transient: the destination account is
   *  gone from the device, so no retry brings it back. Blocks the effect from re-entering
   *  once the user has been handed to support, so the handover happens exactly once. */
  const hasHandedOverRef = useRef(false)
  const isSwapPending = isServerCompleted && isReceiveConfirmed

  /**
   * The same terminal condition reached from the other side. The gate refuses to confirm a
   * receive it cannot read the key for, which is right — confirming would swap away a
   * working session for an unopenable wallet — but it also means the swap below never runs
   * and never resolves false, so without this the handover it owns would be unreachable and
   * the user would wait on a receive that cannot arrive. Shares the one-shot latch with the
   * swap's own handover so only one of the two ever fires.
   */
  useEffect(() => {
    if (!isReceiveUnrecoverable || hasHandedOverRef.current) return
    hasHandedOverRef.current = true
    reportError(
      "Migration resume without destination account",
      new Error("Provisioned self-custodial account is not on this device"),
    )
    navigation.navigate("accountMigrationContactSupport", {
      reason: MigrationSupportReason.SelfCustodialAccountNotOnDevice,
      origin: MigrationSupportOrigin.Resume,
    })
  }, [isReceiveUnrecoverable, navigation])

  useEffect(() => {
    const canAttempt =
      isSwapPending && attempts < MAX_SWAP_ATTEMPTS && !hasHandedOverRef.current
    if (!canAttempt || isSwapInFlightRef.current) return

    /** One swap in flight at a time: it discards a session and cannot be half-run. A
     *  throw bumps the count, which both re-runs this effect for the retry and stops it
     *  once the attempts are spent. */
    isSwapInFlightRef.current = true
    completeMigration()
      .then((hasSwapped) => {
        if (hasSwapped) return

        /** The funds landed server-side but the destination self-custodial account is no
         *  longer on this device (a reinstall wiped its key), so there is no retry that
         *  finishes the swap: hand the user to support with a reason that names exactly
         *  that, and report it once. */
        hasHandedOverRef.current = true
        reportError(
          "Migration resume without destination account",
          new Error("Provisioned self-custodial account is not on this device"),
        )
        navigation.navigate("accountMigrationContactSupport", {
          reason: MigrationSupportReason.SelfCustodialAccountNotOnDevice,
          origin: MigrationSupportOrigin.Resume,
        })
      })
      .catch((err) => {
        reportError("Migration resume swap", err)
        setAttempts((previous) => previous + 1)
      })
      .finally(() => {
        isSwapInFlightRef.current = false
      })
  }, [isSwapPending, attempts, completeMigration, navigation])
}
