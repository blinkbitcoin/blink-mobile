import { useRef } from "react"

/**
 * A one-shot flag the migration gate arms right before it sends the user into the convert
 * screen, so the screen can prefill USD to BTC at 100%, waive the region restriction that
 * would otherwise bounce the user, and return into the migration when it settles.
 *
 * A module flag rather than a route param on purpose: `conversionDetails` is deep-linkable,
 * so a restricted user could forge an origin param and slip past the restriction outside the
 * flow. Nothing but the gate can set this, and the migration works whether or not the server
 * wind-down affects the account, which the wind-down status alone cannot tell (a migration
 * is no longer tied to that cohort).
 */
let migrationConversionArmed = false

export const armMigrationConversion = (): void => {
  migrationConversionArmed = true
}

const consumeMigrationConversionArmed = (): boolean => {
  const wasArmed = migrationConversionArmed
  migrationConversionArmed = false
  return wasArmed
}

/** Clears the flag; for test isolation, never called in production. */
export const resetMigrationConversionArmed = (): void => {
  migrationConversionArmed = false
}

/**
 * Reads and clears the armed flag once on first render, returning it on later renders. A ref
 * guard, not a `useState` initializer: StrictMode double-invokes initializers and would consume
 * the flag twice, but the ref persists across that double render so the read happens once.
 */
export const useConsumeMigrationConversionArmed = (): boolean => {
  const consumedRef = useRef<boolean | null>(null)
  if (consumedRef.current === null) {
    consumedRef.current = consumeMigrationConversionArmed()
  }
  return consumedRef.current
}
