import {
  type BreezSdkInterface,
  type Network,
} from "@breeztech/breez-sdk-spark-react-native"

import { reportError } from "@app/utils/error-logging"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { createReceiveLightning, disconnectSdk, getWalletInfo, initSdk } from "./bridge"
import { storageDirFor } from "./config"

export const MigrationSdkStatus = {
  Ok: "ok",
  NoMnemonic: "no-mnemonic",
  Failed: "failed",
} as const

export type MigrationSdkStatus =
  (typeof MigrationSdkStatus)[keyof typeof MigrationSdkStatus]

type MigrationSdkResult<T> =
  | { status: typeof MigrationSdkStatus.Ok; value: T }
  | { status: typeof MigrationSdkStatus.NoMnemonic }
  | { status: typeof MigrationSdkStatus.Failed; error: Error }

type WithMigrationSdkArgs = {
  accountId: string
  network: Network
  leewaySatPerVbyte: number
  /** Built by the caller, which owns the backend's challenge format, from the pubkey the
   *  wallet hands back. */
  signChallenge: (sparkPubkey: string) => string
}

const toFailed = (
  err: unknown,
): { status: typeof MigrationSdkStatus.Failed; error: Error } => ({
  status: MigrationSdkStatus.Failed,
  error: err instanceof Error ? err : new Error(String(err)),
})

/**
 * Connects the provisioned-but-inactive self-custodial wallet, runs one unit of work
 * against its SDK, and disconnects. The wallet is not the active session, so no connected
 * SDK exists for it; one connection per call covers the work, and connecting twice would
 * race two SDKs on the same storage directory. NoMnemonic means the device never held the
 * key (a reinstall) and is the caller's to route; any other failure is Failed.
 */
const withMigrationSdk = async <T>(
  { accountId, network, leewaySatPerVbyte }: WithMigrationSdkArgs,
  use: (sdk: BreezSdkInterface) => Promise<T>,
): Promise<MigrationSdkResult<T>> => {
  const mnemonic = await KeyStoreWrapper.getMnemonicForAccount(accountId)
  if (!mnemonic) return { status: MigrationSdkStatus.NoMnemonic }

  let sdk: BreezSdkInterface | undefined
  try {
    sdk = await initSdk({
      mnemonic,
      storageDir: storageDirFor(accountId, network),
      network,
      leewaySatPerVbyte,
    })
    const value = await use(sdk)
    return { status: MigrationSdkStatus.Ok, value }
  } catch (err) {
    return toFailed(err)
  } finally {
    if (sdk) {
      await disconnectSdk(sdk).catch((err) => {
        reportError("Migration transfer SDK disconnect", err)
      })
    }
  }
}

/**
 * The signature comes from the SDK rather than the offline signer because `signMessage`
 * SHA256-hashes the message itself, exactly as the backend does when it verifies, where
 * `signEcdsa` would take a digest and hash it a second time.
 */
const signChallengeWith = async (
  sdk: BreezSdkInterface,
  sparkPubkey: string,
  signChallenge: (sparkPubkey: string) => string,
): Promise<string> => {
  const { signature } = await sdk.signMessage({
    message: signChallenge(sparkPubkey),
    compact: true,
  })
  return signature
}

const SECONDS_PER_DAY = 24 * 60 * 60

/**
 * A full day of invoice lifetime. The backend settles the drain within seconds of the
 * commit, so this is far beyond any real payment or retry window, and Spark holds an
 * incoming payment for an offline wallet and claims it on the next sync, so the disconnect
 * right after does not lose it. A long explicit expiry beats leaving it to the SDK's
 * unspecified default: a migration invoice that lapses would strand the transfer.
 */
const MIGRATION_INVOICE_EXPIRY_SECONDS = SECONDS_PER_DAY

/** Exactly the three destination fields `migrationCommit` takes. */
export type MigrationTransferRequest = {
  sparkInvoice: string
  sparkPubkey: string
  proofSignature: string
}

/**
 * Collects what the commit needs to pay a migration into the self-custodial wallet. The
 * pubkey and the invoice are independent, so they resolve together; the signature follows
 * the invoice check so a failed invoice never spends a signature. No amount on the invoice:
 * the server drains what it can and decides the figure, so one naming an amount would only
 * be a second opinion it has to refuse.
 */
export const buildMigrationTransferRequest = (
  args: WithMigrationSdkArgs,
): Promise<MigrationSdkResult<MigrationTransferRequest>> =>
  withMigrationSdk(args, async (sdk) => {
    const [{ identityPubkey }, { invoice, errors }] = await Promise.all([
      getWalletInfo(sdk),
      createReceiveLightning(sdk)({
        memo: undefined,
        expirySecs: MIGRATION_INVOICE_EXPIRY_SECONDS,
      }),
    ])
    if (!invoice) throw new Error(errors?.[0]?.message ?? "No invoice returned")

    const proofSignature = await signChallengeWith(
      sdk,
      identityPubkey,
      args.signChallenge,
    )
    return { sparkInvoice: invoice, sparkPubkey: identityPubkey, proofSignature }
  })

/** The two proof fields `migrationLnAddressTransfer` takes; it re-points the lightning
 *  address rather than moving funds, so it needs no invoice, only the proof of possession. */
type MigrationLnAddressProof = {
  sparkPubkey: string
  proofSignature: string
}

export const buildMigrationLnAddressProof = (
  args: WithMigrationSdkArgs,
): Promise<MigrationSdkResult<MigrationLnAddressProof>> =>
  withMigrationSdk(args, async (sdk) => {
    const { identityPubkey } = await getWalletInfo(sdk)
    const proofSignature = await signChallengeWith(
      sdk,
      identityPubkey,
      args.signChallenge,
    )
    return { sparkPubkey: identityPubkey, proofSignature }
  })
