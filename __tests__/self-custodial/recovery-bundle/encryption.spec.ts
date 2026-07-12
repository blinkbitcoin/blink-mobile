jest.mock("react-native-quick-crypto", () => {
  const crypto = jest.requireActual("crypto") as typeof import("crypto")

  return {
    __esModule: true,
    default: {
      randomBytes: crypto.randomBytes,
      createCipheriv: crypto.createCipheriv,
      createDecipheriv: crypto.createDecipheriv,
      createHmac: crypto.createHmac,
      createHash: crypto.createHash,
    },
    Buffer,
  }
})

import {
  buildEncryptedBundlePayload,
  decryptBundleBackupPayload,
  parseBundleBackupMetadata,
  RecoveryBundlePayloadError,
} from "@app/self-custodial/recovery-bundle/encryption"
import {
  RECOVERY_BUNDLE_SCHEMA,
  type RecoveryBundle,
} from "@app/self-custodial/recovery-bundle/types"

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

const bundle: RecoveryBundle = {
  schema: RECOVERY_BUNDLE_SCHEMA,
  createdAt: "2026-07-12T00:00:00.000Z",
  network: "MAINNET",
  operatorSet: "breez-sdk",
  walletIdentityPublicKey: "02".padEnd(66, "ab"),
  sparkSdkVersion: "breez-sdk-spark-react-native",
  appVersion: "1.0.1",
  leaves: [
    { id: "leaf-1", status: "AVAILABLE", valueSats: 32768, treeNodeHex: "deadbeef" },
  ],
  nodes: [
    { id: "leaf-1", treeNodeHex: "deadbeef" },
    { id: "root-1", treeNodeHex: "cafebabe" },
  ],
  balances: {
    btcSats: "32768",
    usdb: { amount: "0.00", status: "not-covered-by-bitcoin-unilateral-exit" },
  },
}

describe("recovery bundle encrypted payload", () => {
  it("roundtrips encrypt/decrypt with the seed-derived key", () => {
    const payload = buildEncryptedBundlePayload(bundle, TEST_MNEMONIC)
    expect(decryptBundleBackupPayload(payload, TEST_MNEMONIC)).toEqual(bundle)
  })

  it("keeps only non-sensitive metadata in plaintext", () => {
    const payload = buildEncryptedBundlePayload(bundle, TEST_MNEMONIC)
    expect(payload).not.toContain("deadbeef")
    expect(payload).not.toContain("32768")

    const metadata = parseBundleBackupMetadata(payload)
    expect(metadata).toEqual({
      network: "MAINNET",
      walletIdentityPublicKey: bundle.walletIdentityPublicKey,
      bundleCreatedAt: bundle.createdAt,
    })
  })

  it("fails to decrypt with a different seed", () => {
    const payload = buildEncryptedBundlePayload(bundle, TEST_MNEMONIC)
    const otherMnemonic =
      "youth indicate void nation bundle execute ritual artwork harvest genuine plunge captain"
    expect(() => decryptBundleBackupPayload(payload, otherMnemonic)).toThrow(
      RecoveryBundlePayloadError,
    )
  })

  it("rejects payloads with an unknown schema", () => {
    expect(() =>
      decryptBundleBackupPayload(JSON.stringify({ schema: "other" }), TEST_MNEMONIC),
    ).toThrow(/Unsupported/)
  })

  it("returns null metadata for non-bundle JSON", () => {
    expect(parseBundleBackupMetadata("{}")).toBeNull()
    expect(parseBundleBackupMetadata("not json")).toBeNull()
  })
})
