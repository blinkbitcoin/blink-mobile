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

    const { identityPubkey } = await getWalletInfo(sdk)
    const { signature } = await sdk.signMessage({
      message: signChallenge(identityPubkey),
      compact: true,
    })

    /** No amount: the server drains what it can and decides the figure, so an invoice
     *  naming one would only be a second opinion it has to refuse. */
    const { invoice, errors } = await createReceiveLightning(sdk)({ memo: undefined })
    if (!invoice) throw new Error(errors?.[0]?.message ?? "No invoice returned")

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
