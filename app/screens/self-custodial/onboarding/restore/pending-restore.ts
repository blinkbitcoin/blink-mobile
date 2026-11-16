import { BackupMethod } from "@app/self-custodial/providers/backup-state"

export type PendingRestore = {
  mnemonic: string
  method: BackupMethod
}

/**
 * The phrase a restore waits on while its terms are open. It lives in memory only:
 * navigation params are serialisable state that can be persisted or logged, and a seed
 * phrase must never reach either. The terms screen clears it once it leaves the stack.
 */
let pendingRestore: PendingRestore | null = null

export const holdPendingRestore = (restore: PendingRestore): void => {
  pendingRestore = restore
}

export const readPendingRestore = (): PendingRestore | null => pendingRestore

/** With `held`, clears only that restore: a terms screen still leaving the stack must not
 *  drop the phrase a newer request has already put in its place. */
export const clearPendingRestore = (held?: PendingRestore | null): void => {
  if (held !== undefined && pendingRestore !== held) return
  pendingRestore = null
}
