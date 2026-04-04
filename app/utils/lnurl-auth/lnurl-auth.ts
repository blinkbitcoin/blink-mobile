import * as keychain from "react-native-keychain"
import * as bip39 from "bip39"
import * as bip32 from "bip32"
import * as tinySecp256k1 from "tiny-secp256k1"
import { sign } from "@bitcoinerlab/secp256k1"

const LNURL_AUTH_PATH = "m/44'/0'/0'/0/0"

export const deriveLinkingKey = async (
  domain: string,
): Promise<{ privateKey: Buffer; publicKey: string }> => {
  const credentials = await keychain.getGenericPassword({ service: "mnemonic" })
  if (!credentials) {
    throw new Error("No mnemonic found in keychain")
  }

  const mnemonic = credentials.password

  const seed = bip39.mnemonicToSeedSync(mnemonic)

  const root = bip32.BIP32Factory(tinySecp256k1).fromSeed(seed)

  const domainPath = domain.split("").map(c => c.charCodeAt(0)).join("/")
  const fullPath = `${LNURL_AUTH_PATH}/${domainPath}`

  const linkingKey = root.derivePath(fullPath)

  if (!linkingKey.privateKey) {
    throw new Error("Failed to derive linking key")
  }

  return {
    privateKey: Buffer.from(linkingKey.privateKey),
    publicKey: Buffer.from(linkingKey.publicKey).toString("hex"),
  }
}

export const signLnurlChallenge = (
  privateKey: Buffer,
  k1: string,
): string => {
  const k1Bytes = Buffer.from(k1, "hex")

  const signature = sign(k1Bytes, privateKey)

  return derEncodeSignature(signature)
}

const derEncodeSignature = (signature: Uint8Array): string => {
  const r = signature.slice(0, 32)
  const s = signature.slice(32, 64)

  const rLen = 32
  const sLen = 32

  const der = Buffer.alloc(8 + rLen + sLen)
  let offset = 0

  der[offset++] = 0x30
  der[offset++] = 4 + rLen + sLen
  der[offset++] = 0x02
  der[offset++] = rLen
  Buffer.from(r).copy(der, offset)
  offset += rLen
  der[offset++] = 0x02
  der[offset++] = sLen
  Buffer.from(s).copy(der, offset)

  return der.toString("hex")
}