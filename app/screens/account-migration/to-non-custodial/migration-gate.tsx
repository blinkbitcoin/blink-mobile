import React, { useCallback, useState } from "react"

import { useCustodialMigrationRequired } from "@app/hooks/use-custodial-migration-required"

import { useActiveApiKeys } from "../hooks"

import { MigrationApiServiceScreen } from "./api-service-screen"
import { MigrationRequiredScreen } from "./migration-required-screen"

type MigrationGateProps = {
  onClose?: () => void
}

/**
 * Entry gate for the migration flow: accounts with active API keys first see the
 * API-service warning; once acknowledged (or when there are none) they reach the
 * "Time to upgrade" screen.
 *
 * The mode is inferred from the entry: a forced-cohort account reaches the gate as
 * the root blocker (migration required), while the voluntary route from Settings is
 * not. The post-deadline "gate" mode is server-authoritative and wired once the
 * wind-down phase signal exists.
 */
export const MigrationGate: React.FC<MigrationGateProps> = ({ onClose }) => {
  const { hasActiveApiKeys, loading } = useActiveApiKeys()
  const isForced = useCustodialMigrationRequired()
  const [apiWarningAcknowledged, setApiWarningAcknowledged] = useState(false)

  const acknowledgeApiWarning = useCallback(() => setApiWarningAcknowledged(true), [])

  if (loading) return null

  const shouldWarnAboutApiKeys = hasActiveApiKeys && !apiWarningAcknowledged
  if (shouldWarnAboutApiKeys) {
    return <MigrationApiServiceScreen onContinue={acknowledgeApiWarning} />
  }

  const mode = isForced ? "forcedPreDeadline" : "voluntary"
  return <MigrationRequiredScreen mode={mode} onClose={onClose} />
}
