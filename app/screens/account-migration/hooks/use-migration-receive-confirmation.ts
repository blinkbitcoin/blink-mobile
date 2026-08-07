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
 * so the screen can say the wait is unusual and offer support, while still polling.
 */
export const useMigrationReceiveConfirmation = ({
  selfCustodialAccountId,
  expectedReceiveSats,
  skip,
}: UseMigrationReceiveConfirmationArgs): UseMigrationReceiveConfirmation => {
  const network = useSparkNetwork()
  const { selfCustodialDepositClaimLeewayVbyte, migrationReceiveDelayedNoticeMs } =
    useRemoteConfig()
  const [isReceiveConfirmed, setIsReceiveConfirmed] = useState(false)
  const [isReceiveDelayed, setIsReceiveDelayed] = useState(false)

  /** A zero-receive migration (balance at or under an uncovered fee) gets no payment, so
   *  the gate opens without ever touching the SDK; waiting would strand the user forever. */
  const isConfirmedWithoutWaiting = !skip && expectedReceiveSats === 0
  const isWatching =
    !skip &&
    !isConfirmedWithoutWaiting &&
    !isReceiveConfirmed &&
    selfCustodialAccountId !== null

  /** One report however long the polling runs; every retry after the first failure would
   *  file the same story. */
  const hasReportedFailureRef = useRef(false)

  useEffect(() => {
    if (!isWatching || selfCustodialAccountId === null) return

    let isActive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const accountId = selfCustodialAccountId

    const scheduleNextCheck = () => {
      timer = setTimeout(runCheck, RECEIVE_CHECK_RETRY_MS)
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

      /** The wallet's key is gone from the device. The gate must not invent its own
       *  handover: it opens, and the swap it releases already reads the same absence and
       *  routes to support (SelfCustodialAccountMissing / NotOnDevice). */
      if (result.status === MigrationSdkStatus.NoMnemonic) {
        setIsReceiveConfirmed(true)
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

  /** The notice measures the wait for the receive, not the whole transfer: it starts when
   *  the watching starts (server COMPLETED, nothing landed) and is withdrawn if a check
   *  confirms before it fires. */
  useEffect(() => {
    if (!isWatching) return
    const timer = setTimeout(() => {
      setIsReceiveDelayed(true)
    }, migrationReceiveDelayedNoticeMs)
    return () => clearTimeout(timer)
  }, [isWatching, migrationReceiveDelayedNoticeMs])

  return {
    isReceiveConfirmed: isReceiveConfirmed || isConfirmedWithoutWaiting,
    isReceiveDelayed:
      isReceiveDelayed && !isReceiveConfirmed && !isConfirmedWithoutWaiting,
  }
}
