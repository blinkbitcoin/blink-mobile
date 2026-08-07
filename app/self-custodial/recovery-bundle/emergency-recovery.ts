/**
 * Verifying an emergency bundle against a backup phrase.
 *
 * This is what the restore flow can still offer when the Spark operators are
 * unreachable: the seed the user just typed is the decryption key, so checking
 * that a file really is *their* bundle needs no network at all. Verification
 * and "is this the right file" are the same operation - a bundle that decrypts
 * belongs to this seed, and one that does not, does not.
 *
 * It deliberately stops at verified. Performing the on-chain exit is a separate
 * body of work; claiming more here would tell a user their funds are moving
 * when nothing has been broadcast.
 */

import { Network } from "@breeztech/breez-sdk-spark-react-native"

import { networkLabelFor } from "../config"

import { getRecoveryBundleFilename } from "./cloud"
import {
  decryptBundleBackupPayload,
  parseBundleBackupMetadata,
  RecoveryBundlePayloadError,
  RecoveryBundlePayloadErrorReason,
  type RecoveryBundleBackupMetadata,
} from "./encryption"
import { deriveIdentityKeyPair } from "./identity"
import type { RecoveryBundle } from "./types"

const hexEncode = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")

/**
 * Where this seed's bundle would be in the user's cloud.
 *
 * Derivable from the phrase alone, which is what lets the automatic attempt
 * fetch a specific file instead of listing an account the user may not have
 * signed into on this device.
 */
export const expectedBundleFilename = async (
  mnemonic: string,
  network: Network,
): Promise<string> => {
  const { publicKey } = await deriveIdentityKeyPair(mnemonic, network)
  return getRecoveryBundleFilename(networkLabelFor(network), hexEncode(publicKey))
}

export const EmergencyBundleRejection = {
  /** Parsed, but the seed does not decrypt it: someone else's bundle. */
  WrongPhrase: "wrong-phrase",
  /** Not an emergency bundle at all: wrong file picked, or truncated. */
  NotABundle: "not-a-bundle",
} as const

export type EmergencyBundleRejection =
  (typeof EmergencyBundleRejection)[keyof typeof EmergencyBundleRejection]

export type VerifiedEmergencyBundle = {
  bundle: RecoveryBundle
  metadata: RecoveryBundleBackupMetadata
  /** The encrypted payload as supplied, so it can be re-exported as a file. */
  payload: string
}

export type EmergencyBundleVerification =
  | { verified: true; result: VerifiedEmergencyBundle }
  | { verified: false; rejection: EmergencyBundleRejection }

/** A payload that never parsed is a wrong file; only a failed decrypt of a
 *  well-formed bundle points at the phrase. */
const REJECTION_FOR_REASON: Readonly<
  Record<RecoveryBundlePayloadErrorReason, EmergencyBundleRejection>
> = {
  [RecoveryBundlePayloadErrorReason.InvalidPayload]: EmergencyBundleRejection.NotABundle,
  [RecoveryBundlePayloadErrorReason.UnsupportedSchema]:
    EmergencyBundleRejection.NotABundle,
  [RecoveryBundlePayloadErrorReason.DecryptFailed]: EmergencyBundleRejection.WrongPhrase,
  [RecoveryBundlePayloadErrorReason.EnvelopeMismatch]:
    EmergencyBundleRejection.WrongPhrase,
}

export const verifyEmergencyBundle = async (
  payload: string,
  mnemonic: string,
): Promise<EmergencyBundleVerification> => {
  const metadata = parseBundleBackupMetadata(payload)
  if (!metadata) {
    return { verified: false, rejection: EmergencyBundleRejection.NotABundle }
  }

  try {
    const bundle = await decryptBundleBackupPayload(payload, mnemonic)
    return { verified: true, result: { bundle, metadata, payload } }
  } catch (err) {
    if (err instanceof RecoveryBundlePayloadError) {
      return { verified: false, rejection: REJECTION_FOR_REASON[err.reason] }
    }
    // An unrecognised failure is not evidence the file is fine; the user needs
    // to try another one either way.
    return { verified: false, rejection: EmergencyBundleRejection.NotABundle }
  }
}

/** Sats the bundle can carry out on-chain, summed over its leaves. */
export const coveredSats = (bundle: RecoveryBundle): number =>
  bundle.leaves.reduce((total, leaf) => total + leaf.valueSats, 0)
