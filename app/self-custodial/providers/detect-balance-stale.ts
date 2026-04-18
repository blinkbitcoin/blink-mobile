import { TransactionDirection, TransactionStatus } from "@app/types/transaction.types"
import type { WalletState } from "@app/types/wallet.types"

/**
 * Heuristic stale-balance detection: if balance=0 but the wallet has completed
 * incoming txs, the Spark tree sync likely failed (DNS/operator unreachable).
 */
export const detectBalanceStale = (wallets: WalletState[] | undefined): boolean => {
  if (!wallets || !wallets.length) return false

  const totalBalance = wallets.reduce(
    (sum, wallet) => sum + Number(wallet.balance.amount),
    0,
  )
  if (totalBalance) return false

  return wallets.some((wallet) =>
    wallet.transactions.some(
      (tx) =>
        tx.direction === TransactionDirection.Receive &&
        tx.status === TransactionStatus.Completed,
    ),
  )
}
