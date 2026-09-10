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
  Investment: "investment",
} as const

export type DrainConversionReturn =
  (typeof DrainConversionReturn)[keyof typeof DrainConversionReturn]

/**
 * Where the conversion returns, and what the flow needs back to carry on.
 *
 * The two drains that empty a balance need nothing but the destination. The investment
 * step resumes on a figure the investor chose several screens earlier, which no screen
 * downstream can work out on its own, so the arm carries it.
 */
export type DrainConversionArm = {
  target: DrainConversionReturn
  /** Only the investment arm carries one. */
  selectedAmountUsd?: number
}

let drainConversionArmed: DrainConversionArm | null = null

export const armMigrationConversion = (): void => {
  drainConversionArmed = { target: DrainConversionReturn.Migration }
}

/** Same waiver, armed by the Anon-mode switch: its dollar balance must drain first. */
export const armModeSelectionConversion = (): void => {
  drainConversionArmed = { target: DrainConversionReturn.ModeSelection }
}

/**
 * Armed by the investment step when the money is held between both wallets: a payment
 * draws on one, so the investor converts to put the whole amount in a single wallet and
 * lands back on the step they left, for the amount they left it on.
 *
 * Not a drain: this converts what the investor chooses, and claims no waiver.
 */
export const armInvestmentConversion = (selectedAmountUsd: number): void => {
  drainConversionArmed = { target: DrainConversionReturn.Investment, selectedAmountUsd }
}

const consumeDrainConversionArmed = (): DrainConversionArm | null => {
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
export const useConsumeDrainConversionArmed = (): DrainConversionArm | null => {
  const consumedRef = useRef<{ value: DrainConversionArm | null } | null>(null)
  if (consumedRef.current === null) {
    consumedRef.current = { value: consumeDrainConversionArmed() }
  }

  useEffect(() => resetDrainConversionArmed, [])

  return consumedRef.current.value
}
