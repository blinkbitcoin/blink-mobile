import { RootStackParamList } from "./stack-param-lists"

/**
 * The prefix every screen in the migration flow is named with, and the single source of
 * truth for recognising one. Matched as a prefix rather than an enumerated list because the
 * list is what went wrong: the armed gate's reset once allowed the deeplink entry by name
 * and popped everything else, which left out the screens the gate opens ITSELF, and those
 * are the ones a reset is most likely to land on. A gate resuming a locked migration
 * navigates to a checkpoint step, or to contact support when there is nothing to resume,
 * and never to the entry.
 */
const MIGRATION_ROUTE_PREFIX = "accountMigration"

export type MigrationRouteName = Extract<
  keyof RootStackParamList,
  `${typeof MIGRATION_ROUTE_PREFIX}${string}`
>

/** Whether the migration flow is what put this screen on the stack: either the one deeplink
 *  the armed gate lets through, or a screen the gate navigated to itself. */
export const isMigrationRoute = (name: string): name is MigrationRouteName =>
  name.startsWith(MIGRATION_ROUTE_PREFIX)
