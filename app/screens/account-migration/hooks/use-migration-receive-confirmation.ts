import { useEffect, useRef, useState } from "react"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import {
  checkMigrationReceiveLanded,
  MigrationSdkStatus,
} from "@app/self-custodial/migration-transfer-request"
import { reportError } from "@app/utils/error-logging"

/** Between settled checks, not between starts: a check itself takes seconds (a connect
 *  plus a forced sync), and stacking a second one would only queue behind the
 *  per-directory serialization for nothing. */
const RECEIVE_CHECK_RETRY_MS = 5000

/** Past the notice window the wait is no longer a matter of seconds, and the gate never
 *  gives up, so the checks back off rather than opening an SDK connection every 5s for the
 *  rest of the session. */
const DELAYED_RECEIVE_CHECK_RETRY_MS = 30_000

type UseMigrationReceiveConfirmationArgs = {
  selfCustodialAccountId: string | null
  /**
   * What the commit-point preview said the wallet will receive. Zero means nothing will
   * ever arrive, so the gate opens at once; null means the checkpoint predates the field,
   * and an unknown expectation waits like a funded one — the delayed notice is its way out.
   */
  expectedReceiveSats: number | null
  /** True until the server phase is COMPLETED: before the drain is even paid there is
   *  nothing to look for, and each look opens a whole SDK connection. */
  skip: boolean
}

type UseMigrationReceiveConfirmation = {
  isReceiveConfirmed: boolean
  /**
   * Confirmed by an actual look at the wallet, never by the notice window elapsing. The
   * irreversible half of the completion — deleting the custodial account — keys off this
   * rather than `isReceiveConfirmed`, because the timeout release proves nothing about
   * where the funds are, and an account deleted while they are still in it is gone.
   */
  isReceiveProven: boolean
  isReceiveDelayed: boolean
}

/**
 * Whether the migration's payment has landed in the provisioned Spark wallet. The server's
 * COMPLETED is the sender's word only; swapping the session on it alone can land the user
 * in a zero-balance wallet while the funds are still in transit (#4102), so both swap
 * paths wait for this gate. It polls the wallet's synced balance — the sync itself is what
 * claims a payment Spark held for the offline wallet — and never gives up: an unconfirmed
 * receive keeps the user on the working custodial session, which is strictly better than
 * an empty new one. After the remote-configured notice window it raises `isReceiveDelayed`
 * so the screen can say the wait is unusual and offer support, while still polling —
 * unless the delayed-redirect flag is on, in which case the elapsed window releases the
 * gate instead (the pre-#4102 behavior, kept reachable without an app release). That
 * release moves the user, never the custodial account: `isReceiveProven` stays false, so
 * the deletion waits for a real confirmation that no flag can substitute for.
 */
export const useMigrationReceiveConfirmation = ({
  selfCustodialAccountId,
  expectedReceiveSats,
  skip,
}: UseMigrationReceiveConfirmationArgs): UseMigrationReceiveConfirmation => {
  const network = useSparkNetwork()
  const {
    selfCustodialDepositClaimLeewayVbyte,
    migrationReceiveDelayedNoticeMs,
    migrationDelayedRedirectEnabled,
  } = useRemoteConfig()
  const [isReceiveConfirmed, setIsReceiveConfirmed] = useState(false)
  const [isReceiveDelayed, setIsReceiveDelayed] = useState(false)

  /** A zero-receive migration (balance at or under an uncovered fee) gets no payment, so
   *  the gate opens without ever touching the SDK; waiting would strand the user forever. */
  const isConfirmedWithoutWaiting = expectedReceiveSats === 0

  /** The escape hatch: with the flag on, the elapsed notice window opens the gate rather
   *  than raising the notice, so the swap proceeds as it did before the gate existed. */
  const isReleasedByTimeout = isReceiveDelayed && migrationDelayedRedirectEnabled

  const isWatching =
    !skip &&
    !isConfirmedWithoutWaiting &&
    !isReleasedByTimeout &&
    !isReceiveConfirmed &&
    selfCustodialAccountId !== null

  /** One report however long the polling runs; every retry after the first failure would
   *  file the same story. */
  const hasReportedFailureRef = useRef(false)

  /** Mirrors the state for the polling effect, which outlives the flip and must read the
   *  current cadence without re-arming (a re-armed effect fires an extra check at once). */
  const isReceiveDelayedRef = useRef(false)

  useEffect(() => {
    if (!isWatching || selfCustodialAccountId === null) return

    let isActive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const accountId = selfCustodialAccountId

    const scheduleNextCheck = () => {
      const retryMs = isReceiveDelayedRef.current
        ? DELAYED_RECEIVE_CHECK_RETRY_MS
        : RECEIVE_CHECK_RETRY_MS
      timer = setTimeout(runCheck, retryMs)
    }

    const reportOnce = (err: unknown) => {
      if (hasReportedFailureRef.current) return
      hasReportedFailureRef.current = true
      reportError("Migration receive check", err)
    }

    const runCheck = async () => {
      let result: Awaited<ReturnType<typeof checkMigrationReceiveLanded>>
      try {
        result = await checkMigrationReceiveLanded({
          accountId,
          network,
          leewaySatPerVbyte: selfCustodialDepositClaimLeewayVbyte,
        })
      } catch (err) {
        /** A keystore read that threw before the SDK result shape existed: transient as
         *  far as this gate can tell, so it is retried like a lost connection. */
        if (!isActive) return
        reportOnce(err)
        scheduleNextCheck()
        return
      }
      if (!isActive) return

      /**
       * The wallet's key is gone from the device, and the gate must not answer that with a
       * confirmation: the swap it would release checks the account index rather than the
       * keystore, so it would discard the working custodial session for a wallet whose key
       * is unrecoverable, leaving the user with neither. Treated as not-landed instead,
       * which keeps the working session and lets the delayed notice route to support. The
       * re-read is cheap — it settles before any SDK connection is opened.
       */
      if (result.status === MigrationSdkStatus.NoMnemonic) {
        reportOnce(new Error("No mnemonic for the provisioned account"))
        scheduleNextCheck()
        return
      }

      if (result.status === MigrationSdkStatus.Ok && result.value.hasReceived) {
        setIsReceiveConfirmed(true)
        return
      }

      /** Not landed yet, or the check itself failed: either way the funds may still be in
       *  transit, so the only wrong move is to stop looking. A settled failure is reported
       *  (once) rather than surfaced — the user can do nothing with it mid-wait. */
      if (result.status === MigrationSdkStatus.Failed) reportOnce(result.error)
      scheduleNextCheck()
    }

    runCheck()

    return () => {
      isActive = false
      if (timer) clearTimeout(timer)
    }
  }, [isWatching, selfCustodialAccountId, network, selfCustodialDepositClaimLeewayVbyte])

  /** The notice measures the wait for the receive, not the whole transfer: it runs from a
   *  timestamp rather than the effect's own lifetime because both callers recompute `skip`
   *  from inputs that flap, and a window re-armed on each flap would never elapse. */
  const watchStartedAtRef = useRef(0)
  const watchedAccountIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isWatching) return

    /** Only a different wallet starts a fresh window: the wait belongs to one migration's
     *  receive. A caller merely re-skipping deliberately does not reset it. */
    if (watchedAccountIdRef.current !== selfCustodialAccountId) {
      watchedAccountIdRef.current = selfCustodialAccountId
      watchStartedAtRef.current = Date.now()
      isReceiveDelayedRef.current = false
      setIsReceiveDelayed(false)
    }

    const elapsed = Date.now() - watchStartedAtRef.current
    const remaining = Math.max(migrationReceiveDelayedNoticeMs - elapsed, 0)

    const timer = setTimeout(() => {
      isReceiveDelayedRef.current = true
      setIsReceiveDelayed(true)
    }, remaining)
    return () => clearTimeout(timer)
  }, [isWatching, selfCustodialAccountId, migrationReceiveDelayedNoticeMs])

  /** A zero-receive migration counts as proven, not merely released: nothing was ever
   *  going to arrive, so an empty wallet is the confirmed outcome rather than an unknown. */
  const isReceiveProven = !skip && (isReceiveConfirmed || isConfirmedWithoutWaiting)

  /** A skipped gate is inert, whatever it remembers: a caller that re-skips after a
   *  late failure must not keep receiving a notice (or a confirmation) minted for a
   *  swap that is no longer allowed to happen. */
  return {
    isReceiveConfirmed: isReceiveProven || (!skip && isReleasedByTimeout),
    isReceiveProven,
    /** Also masked once anything confirms — including the timeout release, which must
     *  swap at once rather than flash the "taking longer" copy it just made moot. */
    isReceiveDelayed:
      !skip &&
      isReceiveDelayed &&
      !isReceiveConfirmed &&
      !isConfirmedWithoutWaiting &&
      !isReleasedByTimeout,
  }
}
