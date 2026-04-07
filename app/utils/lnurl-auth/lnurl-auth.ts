import * as keychain from "react-native-keychain"
import * as bip39 from "bip39"
import * as bip32 from "bip32"
import * as secp256k1 from "@bitcoinerlab/secp256k1"
import Crypto from "react-native-quick-crypto"
import { generateSecureRandom } from "react-native-securerandom"
import { script as bitcoinScript } from "bitcoinjs-lib"
import { sign } from "@bitcoinerlab/secp256k1"

const LNURL_AUTH_PURPOSE = 138
const LNURL_AUTH_SEED_SERVICE = "lnurl-auth-seed"

export const normalizeLnurlAuthDomain = (domain: string): string => {
  const normalizedInput = domain.trim().toLowerCase()
  if (normalizedInput === "") {
    return ""
  }

  let maybeHost = normalizedInput
  if (normalizedInput.includes("://")) {
    try {
      maybeHost = new URL(normalizedInput).hostname
    } catch {
      return ""
    }
  }

  return maybeHost.replace(/\.+$/, "").replace(/:\d+$/, "")
}

export const assertLnurlAuthCallbackDomainMatch = ({
  callback,
  domain,
}: {
  callback: string
  domain: string
}): void => {
  let callbackUrl: URL
  try {
    callbackUrl = new URL(callback)
  } catch {
    throw new Error("Invalid LNURL-auth callback URL")
  }

  const isLocalhost =
    callbackUrl.hostname === "localhost" || callbackUrl.hostname === "127.0.0.1"
  if (callbackUrl.protocol !== "https:" && !isLocalhost) {
    throw new Error("Invalid LNURL-auth callback protocol")
  }

  const callbackDomain = normalizeLnurlAuthDomain(callbackUrl.hostname)

  const normalizedDomain = normalizeLnurlAuthDomain(domain)

  const isDomainMatch =
    callbackDomain === normalizedDomain ||
    callbackDomain.endsWith(`.${normalizedDomain}`)

  if (callbackDomain === "" || normalizedDomain === "" || !isDomainMatch) {
    throw new Error("LNURL-auth callback domain mismatch")
  }
}

export const assertValidK1 = (k1: string): string => {
  const normalizedK1 = k1.toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(normalizedK1)) {
    throw new Error("Invalid LNURL-auth k1: expected 32-byte hex string")
  }

  return normalizedK1
}

const derivePathSegmentsFromDomain = (hashingPrivateKey: Buffer, domain: string): number[] => {
  const hmac = Crypto.createHmac("sha256", hashingPrivateKey)
  hmac.update(domain, "utf8")
  const digest = hmac.digest()

  return [0, 4, 8, 12].map(offset => digest.readUInt32BE(offset))
}

export const composeLnurlAuthCallbackUrl = ({
  callback,
  k1,
  sig,
  key,
}: {
  callback: string
  k1: string
  sig: string
  key: string
}): string => {
  const urlObject = new URL(callback)
  urlObject.searchParams.set("k1", k1)
  urlObject.searchParams.set("sig", sig)
  urlObject.searchParams.set("key", key)

  return urlObject.toString()
}

export const buildLnurlAuthSignedCallbackUrl = ({
  callback,
  domain,
  k1,
  sig,
  key,
}: {
  callback: string
  domain: string
  k1: string
  sig: string
  key: string
}): string => {
  assertLnurlAuthCallbackDomainMatch({ callback, domain })

  return composeLnurlAuthCallbackUrl({ callback, k1, sig, key })
}

export const deriveLinkingKey = async (
  domain: string,
): Promise<{ privateKey: Buffer; publicKey: string }> => {
  const normalizedDomain = normalizeLnurlAuthDomain(domain)
  if (!normalizedDomain) {
    throw new Error("Invalid LNURL-auth domain")
  }

  const seed = await getLnurlAuthSeed()

  const root = bip32.BIP32Factory(secp256k1).fromSeed(seed)

  const hashingKey = root.deriveHardened(LNURL_AUTH_PURPOSE).derive(0)
  if (!hashingKey.privateKey) {
    throw new Error("Failed to derive LNURL-auth hashing key")
  }

  const linkingPathSegments = derivePathSegmentsFromDomain(
    Buffer.from(hashingKey.privateKey),
    normalizedDomain,
  )

  const linkingKey = linkingPathSegments.reduce(
    (node, index) => node.derive(index),
    root.deriveHardened(LNURL_AUTH_PURPOSE),
  )


  if (!linkingKey.privateKey) {
    throw new Error("Failed to derive linking key")
  }

  return {
    privateKey: Buffer.from(linkingKey.privateKey),
    publicKey: Buffer.from(linkingKey.publicKey).toString("hex"),
  }
}

const getLnurlAuthSeed = async (): Promise<Buffer> => {
  const mnemonicCredentials = await keychain.getGenericPassword({ service: "mnemonic" })
  if (mnemonicCredentials && mnemonicCredentials.password) {
    return bip39.mnemonicToSeedSync(mnemonicCredentials.password)
  }

  const seedCredentials = await keychain.getGenericPassword({
    service: LNURL_AUTH_SEED_SERVICE,
  })
  if (seedCredentials && seedCredentials.password && /^[0-9a-fA-F]{64}$/.test(seedCredentials.password)) {
    return Buffer.from(seedCredentials.password, "hex")
  }

  const randomSeedBytes = await generateSecureRandom(32)
  const seedHex = Buffer.from(randomSeedBytes).toString("hex")

  const saved = await keychain.setGenericPassword(
    LNURL_AUTH_SEED_SERVICE,
    seedHex,
    { service: LNURL_AUTH_SEED_SERVICE },
  )

  if (!saved) {
    throw new Error("Failed to store LNURL-auth seed")
  }

  return Buffer.from(seedHex, "hex")
}

export const signLnurlChallenge = (
  privateKey: Buffer,
  k1: string,
  publicKeyHex?: string,
): string => {
  const k1Bytes = Buffer.from(assertValidK1(k1), "hex")

  const signature = sign(k1Bytes, privateKey)

  if (publicKeyHex) {
    const isValid = secp256k1.verify(k1Bytes, Buffer.from(publicKeyHex, "hex"), signature)
    if (!isValid) {
      throw new Error("Invalid LNURL-auth signature (self-check failed)")
    }
  }

  const derWithHashType = bitcoinScript.signature.encode(Buffer.from(signature), 0x01)
  const derSignature = derWithHashType.subarray(0, -1)

  return Buffer.from(derSignature).toString("hex")
}
