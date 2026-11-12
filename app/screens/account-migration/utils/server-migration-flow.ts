import { MigrationStatus } from "@app/graphql/generated"
import {
  MigrationSupportOrigin,
  MigrationSupportReason,
  ServerMigrationFlow,
} from "@app/types/migration"

/** Exhaustive on purpose: a phase the server adds has no entry here and fails to compile,
 *  so it is decided deliberately rather than falling into whichever branch is nearest. */
const FLOW_BY_STATUS: Record<MigrationStatus, ServerMigrationFlow> = {
  [MigrationStatus.InProgress]: ServerMigrationFlow.Open,
  [MigrationStatus.Transferring]: ServerMigrationFlow.Open,
  [MigrationStatus.Failed]: ServerMigrationFlow.Open,
  [MigrationStatus.NotStarted]: ServerMigrationFlow.NotStarted,
  [MigrationStatus.Completed]: ServerMigrationFlow.Completed,
}

/** The map is exhaustive only for the phases this build knows: the server's enum grows
 *  without an app release, and an older build handed a newer phase would otherwise read
 *  it as no flow at all and route on that guess. */
export const isKnownMigrationStatus = (status: MigrationStatus): boolean =>
  Object.prototype.hasOwnProperty.call(FLOW_BY_STATUS, status)

/**
 * The server's migration phase as one of the answers the flow acts on, for every reader of
 * the phase: the lock, and the commit screen, which reads it on its own instance. One rule
 * for what counts as an answer, wherever it is read.
 *
 * A failed re-read can leave the previous answer in place, so a status is only an answer
 * while the read that carries it is current. A null migration is never the server's word
 * for a cleared flow: its resolver answers NOT_STARTED for an account with no record and
 * throws for anything else, and support's retry resets the record to IN_PROGRESS, so null
 * only ever arrives with an error or before the read settles.
 */
export const resolveServerFlow = (
  status: MigrationStatus | null,
  hasError: boolean,
): ServerMigrationFlow => {
  if (hasError) return ServerMigrationFlow.Unanswered
  if (status === null) return ServerMigrationFlow.Unanswered
  /** A phase this build cannot place is not an answer it can act on: a resume or restart
   *  on a guess is not recoverable. Nor is it unanswered, since asking again only gets the
   *  same phase back, so it is named for the routing to hand over instead. */
  if (!isKnownMigrationStatus(status)) return ServerMigrationFlow.Unrecognised
  return FLOW_BY_STATUS[status]
}

/** Where a phase this build does not know hands over, from the entry and the steps alike:
 *  Back returns to the screen the user came from, and the account travels with it, named
 *  by the caller from the checkpoint's owner, as for a late receive. */
export const statusUnrecognisedSupport = (custodialAccountId: string | null) =>
  ({
    reason: MigrationSupportReason.StatusUnrecognised,
    origin: MigrationSupportOrigin.Resume,
    custodialAccountId: custodialAccountId ?? undefined,
  }) as const
