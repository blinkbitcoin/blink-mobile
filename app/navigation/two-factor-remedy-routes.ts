import { isMigrationRoute, MigrationRouteName } from "./migration-routes"
import { RootStackParamList } from "./stack-param-lists"
import { isUnlockInProgress } from "./unlock-routes"

/**
 * The routes the two-factor gate opens itself, or that its remedies start on: the setup
 * and the non-custodial screens, the factor registrations and the migration. A stack
 * that starts with one of these above the home is one the gate's own flows built, and
 * the gate stays armed beneath it, whatever the flow pushed after it. Matched by
 * prefix, as the migration flow is, so a step a flow adds under its own name is covered
 * without being listed.
 */
const TWO_FACTOR_REMEDY_ROUTE_PREFIXES = [
  "twoFactor",
  "emailRegistration",
  "phoneRegistration",
  "totpRegistration",
] as const

type RemedyRoutePrefix = (typeof TWO_FACTOR_REMEDY_ROUTE_PREFIXES)[number]

export type TwoFactorRemedyRouteName =
  | Extract<keyof RootStackParamList, `${RemedyRoutePrefix}${string}`>
  | MigrationRouteName

export const isTwoFactorRemedyRoute = (name: string): name is TwoFactorRemedyRouteName =>
  TWO_FACTOR_REMEDY_ROUTE_PREFIXES.some((prefix) => name.startsWith(prefix)) ||
  isMigrationRoute(name)

const HOME_ROUTE = "Primary" satisfies keyof RootStackParamList

type StackRoute = { name: string }

/** Whether a screen of the user's own sits between the home and the gate's remedies: a
 *  payment, a scan, the settings, anything that is not the unlock that covers the app.
 *  From the first remedy up the stack is the gate's own, whatever the flow pushed after
 *  it. The gate stands in for the home only while there is no such screen, so it never
 *  tears one down; it waits for the user to come back. */
export const hasWorkingScreenAboveHome = (routes: ReadonlyArray<StackRoute>): boolean => {
  const homeIndex = routes.findIndex((route) => route.name === HOME_ROUTE)
  if (homeIndex === -1) return false
  const routesAboveHome = routes.slice(homeIndex + 1)
  const firstRemedyIndex = routesAboveHome.findIndex((route) =>
    isTwoFactorRemedyRoute(route.name),
  )
  const hasRemedy = firstRemedyIndex !== -1
  const routesBelowRemedies = hasRemedy
    ? routesAboveHome.slice(0, firstRemedyIndex)
    : routesAboveHome
  return routesBelowRemedies.some((route) => !isUnlockInProgress(route))
}
