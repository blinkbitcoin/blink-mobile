import React, { useCallback, useState } from "react"

import { useActiveApiKeys } from "../hooks"

import { MigrationApiServiceScreen } from "./api-service-screen"
import { MigrationRequiredScreen } from "./migration-required-screen"

/**
 * Entry gate for the migration flow: accounts with active API keys first see the
 * API-service warning; once acknowledged (or when there are none) they reach the
 * "Time to upgrade" screen.
 */
export const MigrationGate: React.FC = () => {
  const { hasActiveApiKeys, loading } = useActiveApiKeys()
  const [apiWarningAcknowledged, setApiWarningAcknowledged] = useState(false)

  const acknowledgeApiWarning = useCallback(() => setApiWarningAcknowledged(true), [])

  if (loading) return null

  const shouldWarnAboutApiKeys = hasActiveApiKeys && !apiWarningAcknowledged
  if (shouldWarnAboutApiKeys) {
    return <MigrationApiServiceScreen onContinue={acknowledgeApiWarning} />
  }

  return <MigrationRequiredScreen />
}
