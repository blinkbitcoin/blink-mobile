import {
  type BreezSdkInterface,
  type Network,
} from "@breeztech/breez-sdk-spark-react-native"

import { reportError } from "@app/utils/error-logging"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { createReceiveLightning, disconnectSdk, getWalletInfo, initSdk } from "./bridge"
import { storageDirFor } from "./config"

export const MigrationTransferRequestStatus = {
  Ok: "ok",
  NoMnemonic: "no-mnemonic",
  Failed: "failed",
} as const

export type MigrationTransferRequestStatus =
  (typeof MigrationTransferRequestStatus)[keyof typeof MigrationTransferRequestStatus]

/** Exactly the three destination fields `migrationCommit` takes. */
export type MigrationTransferRequest = {
  sparkInvoice: string
  sparkPubkey: string
  proofSignature: string
}

export type MigrationTransferRequestResult =
  | {
      status: typeof MigrationTransferRequestStatus.Ok
      request: MigrationTransferRequest
    }
  | { status: typeof MigrationTransferRequestStatus.NoMnemonic }
  | { status: typeof MigrationTransferRequestStatus.Failed; error: Error }

type BuildMigrationTransferRequestArgs = {
  accountId: string
  network: Network
  leewaySatPerVbyte: number
  /** Built by the caller, which owns the backend's challenge format, from the pubkey
   *  this function hands back through `signChallenge`. */
  signChallenge: (sparkPubkey: string) => string
}

const toFailed = (err: unknown): MigrationTransferRequestResult => ({
  status: MigrationTransferRequestStatus.Failed,
  error: err instanceof Error ? err : new Error(String(err)),
})

const SECONDS_PER_DAY = 24 * 60 * 60

/**
 * A full day of invoice lifetime. The backend settles the drain within seconds of the
 * commit, so this is far beyond any real payment or retry window, and Spark holds an
 * incoming payment for an offline wallet and claims it on the next sync, so the disconnect
 * right after does not lose it. A long explicit expiry beats leaving it to the SDK's
 * unspecified default: a migration invoice that lapses would strand the transfer.
 */
const MIGRATION_INVOICE_EXPIRY_SECONDS = SECONDS_PER_DAY

/**
 * Collects what the backend needs to pay a migration into a self-custodial wallet that is
 * provisioned but not the active session, so no connected SDK exists for it. One
 * connection covers all three fields: connecting twice would race two SDKs on the same
 * storage directory. The signature comes from the SDK rather than the offline signer
 * because `signMessage` SHA256-hashes the message itself, exactly as the backend does
 * when it verifies, where `signEcdsa` would take a digest and hash it a second time.
 */
export const buildMigrationTransferRequest = async ({
  accountId,
  network,
  leewaySatPerVbyte,
  signChallenge,
}: BuildMigrationTransferRequestArgs): Promise<MigrationTransferRequestResult> => {
  const mnemonic = await KeyStoreWrapper.getMnemonicForAccount(accountId)
  if (!mnemonic) return { status: MigrationTransferRequestStatus.NoMnemonic }

  let sdk: BreezSdkInterface | undefined
  try {
    sdk = await initSdk({
      mnemonic,
      storageDir: storageDirFor(accountId, network),
      network,
      leewaySatPerVbyte,
    })

    /** The pubkey and the invoice are independent, so they resolve together; only the
     *  signature depends on the pubkey and follows it. No amount on the invoice: the
     *  server drains what it can and decides the figure, so one naming an amount would
     *  only be a second opinion it has to refuse. */
    const [{ identityPubkey }, { invoice, errors }] = await Promise.all([
      getWalletInfo(sdk),
      createReceiveLightning(sdk)({
        memo: undefined,
        expirySecs: MIGRATION_INVOICE_EXPIRY_SECONDS,
      }),
    ])
    if (!invoice) throw new Error(errors?.[0]?.message ?? "No invoice returned")

    const { signature } = await sdk.signMessage({
      message: signChallenge(identityPubkey),
      compact: true,
    })

    return {
      status: MigrationTransferRequestStatus.Ok,
      request: {
        sparkInvoice: invoice,
        sparkPubkey: identityPubkey,
        proofSignature: signature,
      },
    }
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
