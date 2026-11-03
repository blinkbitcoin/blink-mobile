import React, { useEffect, useRef } from "react"

import { useNavigationState } from "@react-navigation/native"

import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { useMigrationBlocker } from "@app/screens/account-migration/hooks/use-migration-blocker"
import { MigrationGate } from "@app/screens/account-migration/to-non-custodial/migration-gate"
import { TwoFactorProtectionRequiredScreen } from "@app/screens/two-factor-enforcement"

import { hasWorkingScreenAboveHome } from "./two-factor-remedy-routes"

/**
 * What stands in for the home, in order of precedence: the account-closed gate; then
 * nothing, for the frames the two-factor record read takes before the home has first
 * shown, so a cold start never shows the home before a prompt that replaces it, while
 * a switch to another account keeps the home up through that account's record read,
 * as it already is through the account's own load, rather than flash a blank between
 * the two; then the high-balance blocking screen. That screen arms only while the user
 * is on the home, with no screen of their own above it in the root stack; the tabs,
 * and whatever is open within them, are the home. A block that comes to be owed while
 * they are in a payment or a scan waits for them to come back, rather than tear the
 * screen down, and the frames of a record read after the home has shown are not
 * blanked either.
 */
export const HomeGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  const migrationBlocker = useMigrationBlocker()
  const twoFactor = useTwoFactorEnforcement()
  const hasWorkingScreenAbove = useNavigationState((state) =>
    hasWorkingScreenAboveHome(state.routes),
  )
  const hasHomeShownRef = useRef(false)

  const isPreparingBeforeFirstShow =
    twoFactor.isPreparingSessionStart && !hasHomeShownRef.current
  const isGateArmed = twoFactor.isProtectionGateActive && !hasWorkingScreenAbove
  const isHomeShown =
    !migrationBlocker.isVisible && !isPreparingBeforeFirstShow && !isGateArmed

  useEffect(() => {
    if (isHomeShown) hasHomeShownRef.current = true
  }, [isHomeShown])

  if (migrationBlocker.isVisible) return <MigrationGate />
  if (isPreparingBeforeFirstShow) return null
  if (isGateArmed) return <TwoFactorProtectionRequiredScreen />
  return <>{children}</>
}
