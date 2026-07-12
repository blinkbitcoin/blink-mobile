/**
 * Encrypted wrapper for the recovery bundle at rest (device filesystem and
 * cloud). The AES key is derived deterministically from the wallet's BIP39
 * seed (HMAC-SHA256(seed, context), first 16 bytes), so the only secret needed
 * to decrypt a backup is the seed itself - matching the unilateral-exit trust
 * model where everything derives from the seed.
 *
 * Plaintext envelope fields are limited to what freshness checks and file
 * matching need without the seed; balances and leaf details stay encrypted.
 */

import { decryptAesGcm, encryptAesGcm } from "@app/utils/crypto"

import {
  deriveBundleEncryptionKeyHex,
  RECOVERY_BUNDLE_ENCRYPTION_CONTEXT,
} from "./identity"
import { RECOVERY_BUNDLE_SCHEMA, type RecoveryBundle } from "./types"

export const RECOVERY_BUNDLE_BACKUP_SCHEMA = "blink.recovery-bundle-backup.v1"

const CIPHER = "AES-128-GCM" as const
const KEY_DERIVATION = "hmac-sha256-seed" as const
const GCM_IV_LENGTH = 12

export type RecoveryBundleBackupPayload = {
  schema: typeof RECOVERY_BUNDLE_BACKUP_SCHEMA
  encrypted: true
  cipher: typeof CIPHER
  /** key = first 16 bytes of HMAC-SHA256(bip39 seed, context), hex */
  keyDerivation: typeof KEY_DERIVATION
  context: typeof RECOVERY_BUNDLE_ENCRYPTION_CONTEXT
  network: string
  walletIdentityPublicKey: string
  /** The wrapped bundle's createdAt, readable without decrypting. */
  bundleCreatedAt: string
  iv: string
  data: string
}

export type RecoveryBundleBackupMetadata = {
  network: string
  walletIdentityPublicKey: string
  bundleCreatedAt: string
}

export const RecoveryBundlePayloadErrorReason = {
  InvalidPayload: "invalid-payload",
  UnsupportedSchema: "unsupported-schema",
  DecryptFailed: "decrypt-failed",
} as const

export type RecoveryBundlePayloadErrorReason =
  (typeof RecoveryBundlePayloadErrorReason)[keyof typeof RecoveryBundlePayloadErrorReason]

export class RecoveryBundlePayloadError extends Error {
  constructor(
    readonly reason: RecoveryBundlePayloadErrorReason,
    message: string,
  ) {
    super(message)
    this.name = "RecoveryBundlePayloadError"
  }
}

export const buildEncryptedBundlePayload = (
  bundle: RecoveryBundle,
  mnemonic: string,
): string => {
  const key = deriveBundleEncryptionKeyHex(mnemonic)
  const { data, iv } = encryptAesGcm(JSON.stringify(bundle), key, {
    ivLength: GCM_IV_LENGTH,
  })

  const payload: RecoveryBundleBackupPayload = {
    schema: RECOVERY_BUNDLE_BACKUP_SCHEMA,
    encrypted: true,
    cipher: CIPHER,
    keyDerivation: KEY_DERIVATION,
    context: RECOVERY_BUNDLE_ENCRYPTION_CONTEXT,
    network: bundle.network,
    walletIdentityPublicKey: bundle.walletIdentityPublicKey,
    bundleCreatedAt: bundle.createdAt,
    iv,
    data,
  }
  return JSON.stringify(payload)
}

export const parseBundleBackupMetadata = (
  raw: string,
): RecoveryBundleBackupMetadata | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<RecoveryBundleBackupPayload>
    if (parsed.schema !== RECOVERY_BUNDLE_BACKUP_SCHEMA) return null
    if (
      typeof parsed.walletIdentityPublicKey !== "string" ||
      typeof parsed.bundleCreatedAt !== "string" ||
      typeof parsed.network !== "string"
    ) {
      return null
    }
    return {
      network: parsed.network,
      walletIdentityPublicKey: parsed.walletIdentityPublicKey,
      bundleCreatedAt: parsed.bundleCreatedAt,
    }
  } catch {
    return null
  }
}

export const decryptBundleBackupPayload = (
  raw: string,
  mnemonic: string,
): RecoveryBundle => {
  let parsed: Partial<RecoveryBundleBackupPayload>
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new RecoveryBundlePayloadError(
      RecoveryBundlePayloadErrorReason.InvalidPayload,
      `Recovery bundle payload is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (parsed.schema !== RECOVERY_BUNDLE_BACKUP_SCHEMA || parsed.cipher !== CIPHER) {
    throw new RecoveryBundlePayloadError(
      RecoveryBundlePayloadErrorReason.UnsupportedSchema,
      `Unsupported recovery bundle payload schema/cipher: ${String(parsed.schema)}/${String(parsed.cipher)}`,
    )
  }
  if (typeof parsed.iv !== "string" || typeof parsed.data !== "string") {
    throw new RecoveryBundlePayloadError(
      RecoveryBundlePayloadErrorReason.InvalidPayload,
      "Recovery bundle payload is missing iv/data",
    )
  }

  const key = deriveBundleEncryptionKeyHex(mnemonic)
  let plaintext: string
  try {
    plaintext = decryptAesGcm({ data: parsed.data, key, iv: parsed.iv })
  } catch (err) {
    throw new RecoveryBundlePayloadError(
      RecoveryBundlePayloadErrorReason.DecryptFailed,
      `Recovery bundle decrypt failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const bundle = JSON.parse(plaintext) as RecoveryBundle
  if (bundle.schema !== RECOVERY_BUNDLE_SCHEMA) {
    throw new RecoveryBundlePayloadError(
      RecoveryBundlePayloadErrorReason.UnsupportedSchema,
      `Decrypted payload has unexpected bundle schema: ${String(bundle.schema)}`,
    )
  }
  return bundle
}
