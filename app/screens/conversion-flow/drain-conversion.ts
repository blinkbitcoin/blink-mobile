/**
 * A one-shot flag armed right before sending the user into the convert screen to drain
 * their dollar balance (migration, or the switch to Anon Mode): the screen prefills USD
 * to BTC at 100%, waives the region restriction that would otherwise bounce the user,
 * and returns into the arming flow when it settles.
 *
 * A module flag rather than a route param on purpose: `conversionDetails` is deep-linkable,
 * so a restricted user could forge an origin param and slip past the restriction outside
 * the flow.
 */
import { useEffect, useRef } from "react"

/** Who armed the drain decides where the flow returns once the conversion settles. */
export const DrainConversionReturn = {
  Migration: "migration",
  ModeSelection: "modeSelection",
} as const

export type DrainConversionReturn =
  (typeof DrainConversionReturn)[keyof typeof DrainConversionReturn]

let drainConversionArmed: DrainConversionReturn | null = null

export const armMigrationConversion = (): void => {
  drainConversionArmed = DrainConversionReturn.Migration
}

/** Same waiver, armed by the Anon-mode switch: its dollar balance must drain first. */
export const armModeSelectionConversion = (): void => {
  drainConversionArmed = DrainConversionReturn.ModeSelection
}

const consumeDrainConversionArmed = (): DrainConversionReturn | null => {
  const armed = drainConversionArmed
  drainConversionArmed = null
  return armed
}

/** Clears the flag. Used for test isolation and, on the convert screen's teardown, to drop an
 *  arm that instance never consumed (it was navigated back to rather than freshly mounted), so
 *  a later plain conversion cannot inherit a stale arm. */
export const resetDrainConversionArmed = (): void => {
  drainConversionArmed = null
}

/**
 * Reads and clears the armed flag once on first render, returning it on later renders. A ref
 * guard, not a `useState` initializer: StrictMode double-invokes initializers and would consume
 * the flag twice, but the ref persists across that double render so the read happens once.
 *
 * On teardown it clears the module flag: the freshly mounted consumer has already captured the
 * value into its ref by then, so the only thing this drops is an arm left un-consumed because
 * the screen was reused instead of remounted, which would otherwise promote the next plain
 * conversion into a migration one.
 */
export const useConsumeDrainConversionArmed = (): DrainConversionReturn | null => {
  const consumedRef = useRef<{ value: DrainConversionReturn | null } | null>(null)
  if (consumedRef.current === null) {
    consumedRef.current = { value: consumeDrainConversionArmed() }
  }

  useEffect(() => resetDrainConversionArmed, [])

  return consumedRef.current.value
}
