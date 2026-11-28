import { type DepositInfo } from "@breeztech/breez-sdk-spark-react-native"

import { reportError } from "@app/utils/error-logging"

type NewDepositsListener = (deposits: readonly DepositInfo[]) => void

const listeners = new Set<NewDepositsListener>()

/**
 * Every on-chain deposit the SDK reports as newly seen, from the mempool on, long before
 * it is claimed. Only deposits seen after the wallet's first sync are handed over: the
 * ones that sync finds are history. For observers that react to the deposit itself, such
 * as the incoming transaction splash.
 */
export const onNewDeposits = (listener: NewDepositsListener): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * The deposits of a `NewDeposits` event that are news to the user. The SDK calls a deposit
 * new when its own storage has not seen it, and on storage it has just created (a restore,
 * or this device's first connect of the account) a deposit scan that failed leaves that
 * storage empty: the next scan reports every old unclaimed deposit as new. A deposit seen
 * live comes from the mempool and is not mature yet, so on fresh storage only immature
 * ones are announced. On storage that already existed, a mature one is a real arrival,
 * such as a deposit that confirmed while the app was in the background.
 */
export const depositsToAnnounce = (
  deposits: readonly DepositInfo[],
  { freshStorage }: { freshStorage: boolean },
): readonly DepositInfo[] =>
  freshStorage ? deposits.filter((deposit) => !deposit.isMature) : deposits

/** Called ahead of the wallet refresh the same event triggers: a listener that throws
 *  must not cancel it, so each runs alone. */
export const emitNewDeposits = (deposits: readonly DepositInfo[]): void => {
  listeners.forEach((listener) => {
    try {
      listener(deposits)
    } catch (err) {
      reportError("New deposits listener", err)
    }
  })
}
