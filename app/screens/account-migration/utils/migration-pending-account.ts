import { AccountDescriptor } from "@app/types/wallet"

/**
 * THE reuse rule for a wallet provisioned by an earlier abandoned migration run: the
 * pending record must name a wallet that still exists on this device, otherwise nothing
 * is reusable. ensureAccount applies it before provisioning (reuse over zombie) and the
 * gate applies it to predict that choice (resume over handover, #4070) — one shared
 * predicate, so the prediction can never drift from what the restart actually does.
 */
export const resolveReusablePendingAccount = (
  pendingForActiveAccount: string | null,
  accounts: readonly Pick<AccountDescriptor, "id">[],
): string | null =>
  pendingForActiveAccount &&
  accounts.some((account) => account.id === pendingForActiveAccount)
    ? pendingForActiveAccount
    : null
