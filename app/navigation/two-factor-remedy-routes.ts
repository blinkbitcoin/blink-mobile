import { isMigrationRoute, MigrationRouteName } from "./migration-routes"
import { RootStackParamList } from "./stack-param-lists"

/**
 * The routes the two-factor gate opens itself, or that its remedies start on: the setup
 * and the non-custodial screens, the factor registrations and the migration. A stack
 * that starts with one of these above the home is one the gate's own flows built, which
 * a reset to the gate leaves alone, whatever the flow pushed after it. Matched by
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
