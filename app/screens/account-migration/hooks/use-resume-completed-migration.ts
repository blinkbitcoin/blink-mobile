import { useEffect, useRef, useState } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { MigrationStatus } from "@app/graphql/generated"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { MigrationSupportOrigin, MigrationSupportReason } from "@app/types/migration"
import { reportError } from "@app/utils/error-logging"

import { useCompleteMigration } from "./use-complete-migration"
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
  const { migrationAccountId, migrationLoading, completeMigration } =
    useCompleteMigration()

  const hasUnfinishedMigration = Boolean(migrationAccountId)
  const { status } = useMigrationStatus({ skip: !hasUnfinishedMigration })

  const [attempts, setAttempts] = useState(0)
  const isSwapInFlightRef = useRef(false)

  /** A swap that resolves false is terminal, not transient: the destination account is
   *  gone from the device, so no retry brings it back. Blocks the effect from re-entering
   *  once the user has been handed to support, so the handover happens exactly once. */
  const hasHandedOverRef = useRef(false)
  const isSwapPending =
    status === MigrationStatus.Completed && hasUnfinishedMigration && !migrationLoading

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
