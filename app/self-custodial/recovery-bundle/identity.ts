/**
 * Spark identity key derivation and challenge signing.
 *
 * The identity key lives at m/8797555'/{account}'/0' from the BIP39 seed
 * (same derivation as the Spark SDK's DefaultSigner). The default account
 * number is network-dependent: 1 on mainnet, 0 on regtest - hardcoding 0 on
 * mainnet derives a different wallet identity that owns no leaves.
 *
 * The path is hardened at every level, so derivation only needs HMAC-SHA512
 * and a private-key tweak add - no full BIP32 library.
 */

import { Network } from "@breeztech/breez-sdk-spark-react-native"
import * as secp256k1 from "@bitcoinerlab/secp256k1"
import { mnemonicToSeedSync } from "bip39"
import Crypto from "react-native-quick-crypto"

const SPARK_PURPOSE = 8797555
const IDENTITY_KEY_INDEX = 0
const HARDENED_OFFSET = 0x80000000

export type IdentityKeyPair = {
  privateKey: Uint8Array
  /** Compressed (33-byte) secp256k1 public key. */
  publicKey: Uint8Array
}

export const defaultAccountNumber = (network: Network): number =>
  network === Network.Regtest ? 0 : 1

const hmacSha512 = (key: Uint8Array | string, data: Uint8Array): Uint8Array =>
  Uint8Array.from(Crypto.createHmac("sha512", key).update(data).digest())

export const sha256 = (data: Uint8Array): Uint8Array =>
  Uint8Array.from(Crypto.createHash("sha256").update(data).digest())

type ExtendedKey = { privateKey: Uint8Array; chainCode: Uint8Array }

const masterKeyFromSeed = (seed: Uint8Array): ExtendedKey => {
  const digest = hmacSha512("Bitcoin seed", seed)
  return { privateKey: digest.slice(0, 32), chainCode: digest.slice(32) }
}

const deriveHardenedChild = (parent: ExtendedKey, index: number): ExtendedKey => {
  const data = new Uint8Array(37)
  data.set(parent.privateKey, 1)
  new DataView(data.buffer).setUint32(33, index + HARDENED_OFFSET, false)

  const digest = hmacSha512(parent.chainCode, data)
  const tweak = digest.slice(0, 32)
  const childKey = secp256k1.privateAdd(parent.privateKey, tweak)
  // Probability ~2^-128; BIP32 says skip to the next index, but treat as fatal
  if (!childKey) throw new Error("BIP32: derived invalid child key")
  return { privateKey: Uint8Array.from(childKey), chainCode: digest.slice(32) }
}

export const deriveIdentityKeyPair = (
  mnemonic: string,
  network: Network,
  accountNumber?: number,
): IdentityKeyPair => {
  const seed = Uint8Array.from(mnemonicToSeedSync(mnemonic))
  const account = accountNumber ?? defaultAccountNumber(network)

  let key = masterKeyFromSeed(seed)
  for (const index of [SPARK_PURPOSE, account, IDENTITY_KEY_INDEX]) {
    key = deriveHardenedChild(key, index)
  }

  const publicKey = secp256k1.pointFromScalar(key.privateKey, true)
  if (!publicKey) throw new Error("BIP32: derived invalid identity key")
  return { privateKey: key.privateKey, publicKey: Uint8Array.from(publicKey) }
}

/**
 * Deterministic key for encrypting the recovery bundle at rest, derived from
 * the same BIP39 seed so the bundle is decryptable with the seed alone.
 * AES-128-GCM key (matching app/utils/crypto helpers), hex-encoded.
 */
export const RECOVERY_BUNDLE_ENCRYPTION_CONTEXT = "blink:recovery-bundle:aes-128-gcm:v1"

export const deriveBundleEncryptionKeyHex = (mnemonic: string): string => {
  const seed = Uint8Array.from(mnemonicToSeedSync(mnemonic))
  const digest = Uint8Array.from(
    Crypto.createHmac("sha256", seed)
      .update(Uint8Array.from(Buffer.from(RECOVERY_BUNDLE_ENCRYPTION_CONTEXT, "utf8")))
      .digest(),
  )
  return Buffer.from(digest.slice(0, 16)).toString("hex")
}

const derInteger = (value: Uint8Array): Uint8Array => {
  let start = 0
  while (start < value.length - 1 && value[start] === 0) start += 1
  let trimmed = value.slice(start)
  // eslint-disable-next-line no-bitwise -- DER integers need a pad byte when the high bit is set
  if (trimmed[0] & 0x80) {
    const padded = new Uint8Array(trimmed.length + 1)
    padded.set(trimmed, 1)
    trimmed = padded
  }
  return Uint8Array.from([0x02, trimmed.length, ...trimmed])
}

/** ECDSA over sha256(message), DER-encoded - the operator auth signature format. */
export const signChallenge = (
  message: Uint8Array,
  privateKey: Uint8Array,
): Uint8Array => {
  const compact = secp256k1.sign(sha256(message), privateKey)
  const r = derInteger(Uint8Array.from(compact.slice(0, 32)))
  const s = derInteger(Uint8Array.from(compact.slice(32, 64)))
  return Uint8Array.from([0x30, r.length + s.length, ...r, ...s])
}
