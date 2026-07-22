import {
  type BreezSdkInterface,
  type Network,
} from "@breeztech/breez-sdk-spark-react-native"

import { reportError } from "@app/utils/error-logging"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { createReceiveLightning, disconnectSdk, getWalletInfo, initSdk } from "./bridge"
import { storageDirFor } from "./config"
import { classifySdkError, SelfCustodialErrorCode } from "./sdk-error"

export const MigrationSdkStatus = {
  Ok: "ok",
  NoMnemonic: "no-mnemonic",
  ConnectionError: "connection-error",
  Failed: "failed",
} as const

export type MigrationSdkStatus =
  (typeof MigrationSdkStatus)[keyof typeof MigrationSdkStatus]

type MigrationSdkResult<T> =
  | { status: typeof MigrationSdkStatus.Ok; value: T }
  | { status: typeof MigrationSdkStatus.NoMnemonic }
  | { status: typeof MigrationSdkStatus.ConnectionError; error: Error }
  | { status: typeof MigrationSdkStatus.Failed; error: Error }

type WithMigrationSdkArgs = {
  accountId: string
  network: Network
  leewaySatPerVbyte: number
  /** Built by the caller, which owns the backend's challenge format, from the pubkey the
   *  wallet hands back. */
  signChallenge: (sparkPubkey: string) => string
}

const toError = (err: unknown): Error =>
  err instanceof Error ? err : new Error(String(err))

/**
 * A network-tagged SDK error — a connection dropped during the connect or the call — can be
 * sent again, so it is surfaced as a connection error the caller retries rather than a
 * settled failure that hands the user to support. Every other error is settled.
 */
const toSdkFailure = (
  err: unknown,
):
  | { status: typeof MigrationSdkStatus.ConnectionError; error: Error }
  | { status: typeof MigrationSdkStatus.Failed; error: Error } => {
  const isNetworkError = classifySdkError(err) === SelfCustodialErrorCode.NetworkError
  const status = isNetworkError
    ? MigrationSdkStatus.ConnectionError
    : MigrationSdkStatus.Failed
  return { status, error: toError(err) }
}

/**
 * One SDK connection at a time per storage directory. The migrating wallet is inactive, so
 * no SDK is connected for it and each call opens its own; two overlapping on the same
 * directory would race two SDKs, the hazard this module exists to avoid. Chaining the runs
 * here covers a retry fired mid-connect and a screen re-mounted over a live attempt alike.
 */
const sdkRunsByStorageDir = new Map<string, Promise<unknown>>()

const runExclusivePerStorageDir = <T>(
  storageDir: string,
  task: () => Promise<T>,
): Promise<T> => {
  const prior = sdkRunsByStorageDir.get(storageDir) ?? Promise.resolve()
  const result = prior.then(task, task)
  /** Store a never-rejecting tail so the next caller for this directory chains behind it.
   *  Entries are per (account, network) and few, so the map is left to hold one tail per
   *  directory rather than reaped, keeping the serialization to a single chain. */
  sdkRunsByStorageDir.set(
    storageDir,
    result.then(
      () => undefined,
      () => undefined,
    ),
  )
  return result
}

/**
 * Connects the provisioned-but-inactive self-custodial wallet, runs one unit of work
 * against its SDK, and disconnects. The wallet is not the active session, so no connected
 * SDK exists for it; each call opens its own, serialized per storage directory so two never
 * race. NoMnemonic means the device never held the key (a reinstall) and is the caller's to
 * route; a network-tagged failure is a retryable ConnectionError; any other failure is Failed.
 */
const withMigrationSdk = async <T>(
  { accountId, network, leewaySatPerVbyte }: WithMigrationSdkArgs,
  use: (sdk: BreezSdkInterface) => Promise<T>,
): Promise<MigrationSdkResult<T>> => {
  const mnemonic = await KeyStoreWrapper.getMnemonicForAccount(accountId)
  if (!mnemonic) return { status: MigrationSdkStatus.NoMnemonic }

  const storageDir = storageDirFor(accountId, network)
  return runExclusivePerStorageDir(storageDir, async () => {
    let sdk: BreezSdkInterface | undefined
    try {
      sdk = await initSdk({ mnemonic, storageDir, network, leewaySatPerVbyte })
      const value = await use(sdk)
      return { status: MigrationSdkStatus.Ok, value }
    } catch (err) {
      return toSdkFailure(err)
    } finally {
      if (sdk) {
        await disconnectSdk(sdk).catch((err) => {
          reportError("Migration transfer SDK disconnect", err)
        })
      }
    }
  })
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
