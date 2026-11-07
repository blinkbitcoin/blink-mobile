import { type DepositInfo } from "@breeztech/breez-sdk-spark-react-native"

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

export const emitNewDeposits = (deposits: readonly DepositInfo[]): void => {
  listeners.forEach((listener) => listener(deposits))
}
