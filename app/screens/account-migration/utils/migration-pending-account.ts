import { AccountDescriptor } from "@app/types/wallet"

/**
 * THE reuse rule for a wallet provisioned by an earlier abandoned migration run: the
 * pending record must name a wallet that still exists on this device, otherwise nothing
 * is reusable. ensureAccount applies it before provisioning (reuse over zombie) and the
 * gate applies it to predict that choice (resume over handover, #4070), one shared
 * predicate, so the prediction can never drift from what the restart actually does.
 *
 * A record naming the account already in use needs no rule of its own: the owner id this
 * record is keyed by comes from the custodial `me` query, which is skipped for any session
 * that is not custodial, so `pendingForActiveAccount` is already null the moment the
 * provisioned wallet is the active one.
 */
export const resolveReusablePendingAccount = (
  pendingForActiveAccount: string | null,
  accounts: readonly Pick<AccountDescriptor, "id">[],
): string | null => {
  if (!pendingForActiveAccount) return null

  const isOnDevice = accounts.some((account) => account.id === pendingForActiveAccount)
  if (!isOnDevice) return null

  return pendingForActiveAccount
}
