import { loadJson, remove, save } from "@app/utils/storage"

/**
 * When the receive into one migration's wallet first ran past the notice window, kept so a
 * relaunch picks the wait up where it was rather than starting the window over. A receive
 * stuck for days would otherwise spend the first minute of every launch on "on its way",
 * bouncing a tap on Migrate home instead of offering support.
 *
 * Keyed by the provisioned wallet, the one thing the wait belongs to: another migration's
 * wallet never inherits it. Best effort throughout, since all it can cost is that minute:
 * an unreadable or unwritable store leaves the window as it always was.
 */
const STORAGE_KEY_PREFIX = "migrationReceiveDelayedSince"

export const getReceiveDelayedSinceKey = (selfCustodialAccountId: string): string =>
  `${STORAGE_KEY_PREFIX}_${selfCustodialAccountId}`

export const loadReceiveDelayedSince = async (
  selfCustodialAccountId: string,
): Promise<number | null> => {
  const raw: unknown = await loadJson(getReceiveDelayedSinceKey(selfCustodialAccountId))
  const isUsable = typeof raw === "number" && Number.isFinite(raw)
  return isUsable ? raw : null
}

export const saveReceiveDelayedSince = async (
  selfCustodialAccountId: string,
  delayedSince: number,
): Promise<void> => {
  await save(getReceiveDelayedSinceKey(selfCustodialAccountId), delayedSince)
}

/** Dropped with the checkpoint once the migration finishes, so nothing outlives the run. */
export const clearReceiveDelayedSince = (selfCustodialAccountId: string): Promise<void> =>
  remove(getReceiveDelayedSinceKey(selfCustodialAccountId))
