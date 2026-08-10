import { useCallback, useEffect, useRef, useState } from "react"
import { AppState } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { MigrationStatus } from "@app/graphql/generated"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  MigrationCompletion,
  MigrationSupportOrigin,
  MigrationSupportReason,
} from "@app/types/migration"
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
    migrationAccountId,
    migrationExpectedReceiveSats,
    custodialAccountId,
    migrationLoading,
    completeMigration,
  } = useCompleteMigration()

  const hasUnfinishedMigration = Boolean(migrationAccountId)
  const { status } = useMigrationStatus({ skip: !hasUnfinishedMigration })

  const [attempts, setAttempts] = useState(0)
  const isSwapInFlightRef = useRef(false)

  const isServerCompleted =
    status === MigrationStatus.Completed && hasUnfinishedMigration && !migrationLoading

  /** The same receive gate as the transfer screen: a relaunch mid-transfer must not close
   *  the custodial account, nor swap into a wallet whose funds are still in transit
   *  (#4102). Unconfirmed simply means no swap this session — the custodial session stays
   *  intact and the next launch (or this one, once a check lands) picks the swap back up. */
  const { isReceiveConfirmed, isReceiveProven, isReceiveDelayed } =
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

  /** Blocks the effect from re-entering once the user has been handed to support, so a
   *  terminal outcome hands over exactly once. */
  const hasHandedOverRef = useRef(false)

  /** An unsettled close is a dropped connection, and the attempt budget exists for a briefly
   *  locked keystore: spending it here would fire three calls against the same dead network
   *  within milliseconds. One per foreground instead, so the retry rides the moment the user
   *  comes back rather than waiting for the OS to kill the process. */
  const hasDeferredCloseRef = useRef(false)
  const [closeRetryCount, setCloseRetryCount] = useState(0)

  /** Foregrounding is the cheapest signal that the connection may be back, and the only one
   *  this hook can watch without a screen: it is mounted under the tab navigator with no UI
   *  of its own, so nothing else here ever tells it to look again. */
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const isDeferredCloseWaiting =
        nextAppState === "active" && hasDeferredCloseRef.current
      if (!isDeferredCloseWaiting) return
      hasDeferredCloseRef.current = false
      setCloseRetryCount((previous) => previous + 1)
    })

    return () => subscription.remove()
  }, [])

  const isSwapPending = isServerCompleted && isReceiveConfirmed

  const handOverToSupport = useCallback(
    (reason: MigrationSupportReason) => {
      hasHandedOverRef.current = true
      navigation.navigate("accountMigrationContactSupport", {
        reason,
        origin: MigrationSupportOrigin.Resume,
        custodialAccountId: custodialAccountId ?? undefined,
      })
    },
    [navigation, custodialAccountId],
  )

  useEffect(() => {
    const isSettled = hasHandedOverRef.current || hasDeferredCloseRef.current
    const canAttempt = isSwapPending && attempts < MAX_SWAP_ATTEMPTS && !isSettled
    if (!canAttempt || isSwapInFlightRef.current) return

    /** One swap in flight at a time: it closes an account and discards a session, and
     *  cannot be half-run. A spent attempt bumps the count, which both re-runs this effect
     *  for the retry and stops it once the attempts are gone. */
    isSwapInFlightRef.current = true
    completeMigration({ isReceiveProven })
      .then((completion) => {
        /** Exhaustive on purpose: the fallthrough of an if-chain here is a support handover
         *  under a reason that would be a lie, so a new outcome has to be a type error
         *  rather than a ticket nobody can act on. */
        switch (completion) {
          case MigrationCompletion.Completed:
            return

          /** The close never settled, so the custodial token is still alive and a later
           *  attempt can still spend it. Nothing is lost meanwhile: the custodial session
           *  keeps working and the provisioned account is already in the switcher. */
          case MigrationCompletion.CloseUnavailable:
            hasDeferredCloseRef.current = true
            return

          case MigrationCompletion.CloseRefused:
            handOverToSupport(MigrationSupportReason.CustodialAccountCloseRefused)
            return

          /** The funds landed server-side but the destination self-custodial account is no
           *  longer on this device (a reinstall wiped its key), so no retry finishes the
           *  swap: name exactly that, and report it once. */
          case MigrationCompletion.AccountMissing:
            reportError(
              "Migration resume without destination account",
              new Error("Provisioned self-custodial account is not on this device"),
            )
            handOverToSupport(MigrationSupportReason.SelfCustodialAccountNotOnDevice)
            return

          default: {
            const unhandledCompletion: never = completion
            reportError(
              "Migration resume unhandled completion",
              new Error(`Unhandled completion: ${String(unhandledCompletion)}`),
            )
          }
        }
      })
      .catch((err) => {
        reportError("Migration resume swap", err)
        setAttempts((previous) => previous + 1)
      })
      .finally(() => {
        isSwapInFlightRef.current = false
      })
  }, [
    isSwapPending,
    isReceiveProven,
    attempts,
    closeRetryCount,
    completeMigration,
    handOverToSupport,
  ])
}
