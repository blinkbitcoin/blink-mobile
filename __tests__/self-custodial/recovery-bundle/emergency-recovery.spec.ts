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

import { Network } from "@breeztech/breez-sdk-spark-react-native"

import {
  buildEncryptedBundlePayload,
  RECOVERY_BUNDLE_BACKUP_SCHEMA,
} from "@app/self-custodial/recovery-bundle/encryption"
import {
  coveredSats,
  EmergencyBundleRejection,
  expectedBundleFilename,
  verifyEmergencyBundle,
} from "@app/self-custodial/recovery-bundle/emergency-recovery"
import {
  RECOVERY_BUNDLE_SCHEMA,
  type RecoveryBundle,
} from "@app/self-custodial/recovery-bundle/types"

// Real crypto throughout: the whole claim of this module is that a bundle
// decrypts with one seed and not another, which a stubbed cipher cannot show.
const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
const OTHER_MNEMONIC =
  "legal winner thank year wave sausage worth useful legal winner thank yellow"

const bundle: RecoveryBundle = {
  schema: RECOVERY_BUNDLE_SCHEMA,
  createdAt: "2026-08-05T10:00:00.000Z",
  network: "REGTEST",
  operatorSet: "regtest-set",
  walletIdentityPublicKey: "02aa",
  sparkSdkVersion: "1.0.0",
  appVersion: "5.0.0",
  leaves: [
    { id: "leaf-1", status: "AVAILABLE", valueSats: 20000, treeNodeHex: "aa" },
    { id: "leaf-2", status: "AVAILABLE", valueSats: 1000, treeNodeHex: "bb" },
  ],
  nodes: [{ id: "node-1", treeNodeHex: "cc" }],
  balances: {
    btcSats: "21000",
    usdb: { amount: "0", status: "not-covered-by-bitcoin-unilateral-exit" },
  },
}

describe("verifyEmergencyBundle", () => {
  it("accepts a bundle encrypted with the same phrase", async () => {
    const payload = await buildEncryptedBundlePayload(bundle, MNEMONIC)

    const outcome = await verifyEmergencyBundle(payload, MNEMONIC)

    expect(outcome.verified).toBe(true)
    if (!outcome.verified) throw new Error("unreachable")
    expect(outcome.result.bundle.leaves).toHaveLength(2)
    expect(outcome.result.metadata.bundleCreatedAt).toBe(bundle.createdAt)
    // The payload is carried through so the summary can re-export it as a file.
    expect(outcome.result.payload).toBe(payload)
  })

  it("blames the phrase when a real bundle will not decrypt", async () => {
    // Someone else's bundle, or the user's own from a different wallet: the
    // envelope is well-formed, so the mismatch is between phrase and file.
    const payload = await buildEncryptedBundlePayload(bundle, OTHER_MNEMONIC)

    const outcome = await verifyEmergencyBundle(payload, MNEMONIC)

    expect(outcome).toEqual({
      verified: false,
      rejection: EmergencyBundleRejection.WrongPhrase,
    })
  })

  it("blames the file when the payload is not JSON", async () => {
    const outcome = await verifyEmergencyBundle("not json at all", MNEMONIC)

    expect(outcome).toEqual({
      verified: false,
      rejection: EmergencyBundleRejection.NotABundle,
    })
  })

  it("blames the file when the JSON is not a bundle envelope", async () => {
    // Telling this user to re-check their backup phrase would send them
    // hunting for a mistake in something that is fine.
    const outcome = await verifyEmergencyBundle(
      JSON.stringify({ hello: "world" }),
      MNEMONIC,
    )

    expect(outcome).toEqual({
      verified: false,
      rejection: EmergencyBundleRejection.NotABundle,
    })
  })

  it("blames the file when the envelope is missing its identity", async () => {
    const outcome = await verifyEmergencyBundle(
      JSON.stringify({
        schema: RECOVERY_BUNDLE_BACKUP_SCHEMA,
        network: "REGTEST",
        bundleCreatedAt: bundle.createdAt,
      }),
      MNEMONIC,
    )

    expect(outcome).toEqual({
      verified: false,
      rejection: EmergencyBundleRejection.NotABundle,
    })
  })

  it("rejects an envelope whose metadata was edited after encryption", async () => {
    // The identity is authenticated, so swapping it is caught rather than
    // silently trusted.
    const payload = await buildEncryptedBundlePayload(bundle, MNEMONIC)
    const tampered = JSON.stringify({
      ...JSON.parse(payload),
      walletIdentityPublicKey: "02ff",
    })

    const outcome = await verifyEmergencyBundle(tampered, MNEMONIC)

    expect(outcome.verified).toBe(false)
  })

  it("rejects rather than throws when decryption fails in an unforeseen way", async () => {
    // decryptBundleBackupPayload classifies what it anticipates; anything else
    // reaching the screen as a thrown error would take the tree down instead of
    // offering another attempt. Forced, because by construction the classified
    // reasons are the only ones it raises today.
    const payload = await buildEncryptedBundlePayload(bundle, MNEMONIC)
    jest.resetModules()
    jest.doMock("@app/self-custodial/recovery-bundle/encryption", () => ({
      ...jest.requireActual("@app/self-custodial/recovery-bundle/encryption"),
      decryptBundleBackupPayload: () => Promise.reject(new Error("boom")),
    }))

    try {
      const isolated = await import(
        "@app/self-custodial/recovery-bundle/emergency-recovery"
      )

      await expect(isolated.verifyEmergencyBundle(payload, MNEMONIC)).resolves.toEqual({
        verified: false,
        rejection: EmergencyBundleRejection.NotABundle,
      })
    } finally {
      jest.dontMock("@app/self-custodial/recovery-bundle/encryption")
      jest.resetModules()
    }
  })
})

describe("expectedBundleFilename", () => {
  it("names the file this phrase's bundle would be stored under", async () => {
    // Derivable offline, which is what lets the flow look before it asks.
    const name = await expectedBundleFilename(MNEMONIC, Network.Regtest)

    expect(name).toMatch(/^blink-spark-recovery-bundle-regtest-[0-9a-f]{66}\.json$/)
  })

  it("gives different phrases different filenames", async () => {
    const [mine, theirs] = await Promise.all([
      expectedBundleFilename(MNEMONIC, Network.Regtest),
      expectedBundleFilename(OTHER_MNEMONIC, Network.Regtest),
    ])

    expect(mine).not.toBe(theirs)
  })

  it("separates networks, since the identity differs per network", async () => {
    const [regtest, mainnet] = await Promise.all([
      expectedBundleFilename(MNEMONIC, Network.Regtest),
      expectedBundleFilename(MNEMONIC, Network.Mainnet),
    ])

    expect(regtest).toContain("-regtest-")
    expect(mainnet).toContain("-mainnet-")
    expect(regtest).not.toBe(mainnet)
  })
})

describe("coveredSats", () => {
  it("sums what the bundle can carry out on-chain", () => {
    expect(coveredSats(bundle)).toBe(21000)
  })

  it("is zero for a bundle with no leaves", () => {
    expect(coveredSats({ ...bundle, leaves: [] })).toBe(0)
  })
})
