/**
 * Unilateral-exit recovery bundle: a snapshot of the wallet's Spark leaves and
 * their ancestor transactions, fetched from the Spark operators while they are
 * online. It is the only data (besides the seed) needed to force-exit funds on
 * chain if the operators disappear, and it cannot be reconstructed from the
 * seed alone once they do.
 *
 * The JSON shape mirrors the `spark.unilateral-exit-bundle.v1` schema produced
 * by the blinkbitcoin/spark-unilateral-exit exporter so bundles saved by the
 * app feed that tooling directly.
 */

export const RECOVERY_BUNDLE_SCHEMA = "spark.unilateral-exit-bundle.v1"

export type RecoveryBundleLeaf = {
  id: string
  status: string
  valueSats: number
  treeNodeHex: string
}

export type RecoveryBundleNode = {
  id: string
  treeNodeHex: string
}

export type RecoveryBundleBalances = {
  btcSats: string
  usdb: {
    amount: string
    status: string
  }
}

export type RecoveryBundle = {
  schema: typeof RECOVERY_BUNDLE_SCHEMA
  createdAt: string
  network: string
  operatorSet: string
  walletIdentityPublicKey: string
  sparkSdkVersion: string
  appVersion: string
  leaves: RecoveryBundleLeaf[]
  nodes: RecoveryBundleNode[]
  balances: RecoveryBundleBalances
}

export const USDB_NOT_COVERED_STATUS = "not-covered-by-bitcoin-unilateral-exit"
