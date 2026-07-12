import nodeCrypto from "crypto"

jest.mock("react-native-quick-crypto", () => {
  const crypto = jest.requireActual("crypto") as typeof import("crypto")

  return {
    __esModule: true,
    default: {
      randomBytes: crypto.randomBytes,
      pbkdf2Sync: crypto.pbkdf2Sync,
      createCipheriv: crypto.createCipheriv,
      createDecipheriv: crypto.createDecipheriv,
      createHmac: crypto.createHmac,
      createHash: crypto.createHash,
      constants: crypto.constants,
    },
    Buffer,
  }
})

import * as secp256k1 from "@bitcoinerlab/secp256k1"
import { Network } from "@breeztech/breez-sdk-spark-react-native"

import {
  defaultAccountNumber,
  deriveBundleEncryptionKeyHex,
  deriveIdentityKeyPair,
  sha256,
  signChallenge,
} from "@app/self-custodial/recovery-bundle/identity"

/**
 * Golden vectors computed with an independent pure-Python BIP32/BIP39
 * implementation (hashlib/hmac + textbook secp256k1 math) for the path
 * m/8797555'/{account}'/0'. The path itself is confirmed against both the
 * official JS spark-sdk (`hdkey.derive("m/8797555'/{account}'/0'")`) and the
 * vendored Rust SDK's default_signer.rs.
 */
const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
const MAINNET_IDENTITY_PUB =
  "0281363910b0dc0015a4a25e758da30f0e28388ea5252c0e3713936f2d4ef7d3d5"
const MAINNET_IDENTITY_PRIV =
  "07ede284a8976f380b6922de4b14f3a30d1c09b4e57e12cebad5d37ee2e2e6c1"
const REGTEST_IDENTITY_PUB =
  "02698b27ac308b275671b3ca25436346469d04a5bba578ae39feba1d65897a6abc"

describe("spark identity derivation", () => {
  it("uses the network-dependent default account number (mainnet=1, regtest=0)", () => {
    expect(defaultAccountNumber(Network.Mainnet)).toBe(1)
    expect(defaultAccountNumber(Network.Regtest)).toBe(0)
  })

  it("derives the mainnet identity key at m/8797555'/1'/0'", async () => {
    const keyPair = await deriveIdentityKeyPair(TEST_MNEMONIC, Network.Mainnet)
    expect(Buffer.from(keyPair.privateKey).toString("hex")).toBe(MAINNET_IDENTITY_PRIV)
    expect(Buffer.from(keyPair.publicKey).toString("hex")).toBe(MAINNET_IDENTITY_PUB)
  })

  it("derives the regtest identity key at m/8797555'/0'/0'", async () => {
    const keyPair = await deriveIdentityKeyPair(TEST_MNEMONIC, Network.Regtest)
    expect(Buffer.from(keyPair.publicKey).toString("hex")).toBe(REGTEST_IDENTITY_PUB)
  })

  it("respects an explicit account number override", async () => {
    const withOverride = await deriveIdentityKeyPair(TEST_MNEMONIC, Network.Regtest, 1)
    expect(Buffer.from(withOverride.publicKey).toString("hex")).toBe(MAINNET_IDENTITY_PUB)
  })
})

describe("challenge signing", () => {
  it("produces a DER-encoded ECDSA signature over sha256(message) that verifies", async () => {
    const keyPair = await deriveIdentityKeyPair(TEST_MNEMONIC, Network.Mainnet)
    const message = Uint8Array.from(Buffer.from("challenge-bytes", "utf8"))

    const der = signChallenge(message, keyPair.privateKey)

    // DER structure: 0x30 len 0x02 lenR R 0x02 lenS S
    expect(der[0]).toBe(0x30)
    expect(der[1]).toBe(der.length - 2)
    expect(der[2]).toBe(0x02)
    const rLength = der[3]
    const r = der.subarray(4, 4 + rLength)
    expect(der[4 + rLength]).toBe(0x02)
    const s = der.subarray(4 + rLength + 2)

    const pad32 = (bytes: Uint8Array): Buffer => {
      const stripped = Buffer.from(bytes).subarray(
        Math.max(0, bytes.length - 32),
        bytes.length,
      )
      return Buffer.concat([Buffer.alloc(32 - stripped.length, 0), stripped])
    }
    const compact = Uint8Array.from(Buffer.concat([pad32(r), pad32(s)]))

    expect(secp256k1.verify(sha256(message), keyPair.publicKey, compact)).toBe(true)
    // node's crypto agrees the DER signature is valid for this key
    const spki = nodeCrypto.createPublicKey({
      key: Buffer.concat([
        Buffer.from("3036301006072a8648ce3d020106052b8104000a032200", "hex"),
        Buffer.from(keyPair.publicKey),
      ]),
      format: "der",
      type: "spki",
    })
    expect(
      nodeCrypto.verify(
        "sha256",
        Buffer.from(message),
        { key: spki, dsaEncoding: "der" },
        Buffer.from(der),
      ),
    ).toBe(true)
  })
})

describe("bundle encryption key derivation", () => {
  it("is deterministic and produces a 16-byte hex key", async () => {
    const key1 = await deriveBundleEncryptionKeyHex(TEST_MNEMONIC)
    const key2 = await deriveBundleEncryptionKeyHex(TEST_MNEMONIC)
    expect(key1).toBe(key2)
    expect(key1).toMatch(/^[0-9a-f]{32}$/)
  })

  it("matches the documented derivation: HMAC-SHA256(seed, context) first 16 bytes", async () => {
    const seed = nodeCrypto.pbkdf2Sync(
      TEST_MNEMONIC.normalize("NFKD"),
      "mnemonic",
      2048,
      64,
      "sha512",
    )
    const expected = nodeCrypto
      .createHmac("sha256", seed)
      .update("blink:recovery-bundle:aes-128-gcm:v1")
      .digest()
      .subarray(0, 16)
      .toString("hex")
    expect(await deriveBundleEncryptionKeyHex(TEST_MNEMONIC)).toBe(expected)
  })
})
