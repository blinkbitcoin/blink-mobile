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
  fetchRecoveryBundle,
  findMissingAncestors,
  RecoveryBundleExportError,
} from "@app/self-custodial/recovery-bundle/exporter"
import { deriveIdentityKeyPair } from "@app/self-custodial/recovery-bundle/identity"
import {
  decodeFields,
  firstField,
  ProtoWriter,
} from "@app/self-custodial/recovery-bundle/protocol/wire"
import { RECOVERY_BUNDLE_SCHEMA } from "@app/self-custodial/recovery-bundle/types"
import type { DecodedTreeNode } from "@app/self-custodial/recovery-bundle/protocol/messages"

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

// --- test-side encoders for operator responses ---

const frame = (flag: number, payload: Uint8Array): Uint8Array => {
  const framed = new Uint8Array(5 + payload.length)
  framed[0] = flag
  new DataView(framed.buffer).setUint32(1, payload.length, false)
  framed.set(payload, 5)
  return framed
}

const grpcBody = (message: Uint8Array): Uint8Array => {
  const trailer = frame(0x80, Uint8Array.from(Buffer.from("grpc-status: 0", "utf8")))
  const out = new Uint8Array(frame(0, message).length + trailer.length)
  out.set(frame(0, message), 0)
  out.set(trailer, frame(0, message).length)
  return out
}

type TestNode = {
  id: string
  valueSats: number
  parentNodeId?: string
  owner: Uint8Array
  available: boolean
}

const encodeTreeNode = (node: TestNode): Uint8Array => {
  const writer = new ProtoWriter()
    .string(1, node.id)
    .string(2, "tree-1")
    .varint(3, node.valueSats)
  if (node.parentNodeId) writer.string(4, node.parentNodeId)
  return writer
    .bytes(9, node.owner)
    .string(11, node.available ? "AVAILABLE" : "SPLITTED")
    .varint(19, node.available ? 1 : 5)
    .finish()
}

const encodeQueryNodesResponse = (nodes: TestNode[]): Uint8Array => {
  const writer = new ProtoWriter()
  for (const node of nodes) {
    writer.bytes(
      1,
      new ProtoWriter().string(1, node.id).bytes(2, encodeTreeNode(node)).finish(),
    )
  }
  // offset omitted (0) terminates the exporter's paging loop
  return writer.finish()
}

const encodeChallengeResponse = (): Uint8Array => {
  const challenge = new ProtoWriter()
    .varint(1, 1)
    .varint(2, 1752300000)
    .bytes(3, Uint8Array.from(Buffer.alloc(32, 0x11)))
    .finish()
  const protectedChallenge = new ProtoWriter()
    .varint(1, 1)
    .bytes(2, challenge)
    .bytes(3, Uint8Array.from(Buffer.alloc(32, 0xaa)))
    .finish()
  return new ProtoWriter().bytes(1, protectedChallenge).finish()
}

const encodeVerifyResponse = (): Uint8Array =>
  new ProtoWriter().string(1, "session-token").varint(2, 9999999999).finish()

/** Mounts a fake operator behind global.fetch. */
const mockOperator = ({
  ownerQueryNodes,
  byIdNodes,
}: {
  ownerQueryNodes: TestNode[]
  byIdNodes: Record<string, TestNode>
}) => {
  const byIdRequests: string[][] = []

  global.fetch = jest.fn(async (url: string, init: { body: Uint8Array }) => {
    const respond = (message: Uint8Array) => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      arrayBuffer: async () => {
        const body = grpcBody(message)
        return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)
      },
    })

    if (url.endsWith("/spark_authn.SparkAuthnService/get_challenge")) {
      return respond(encodeChallengeResponse())
    }
    if (url.endsWith("/spark_authn.SparkAuthnService/verify_challenge")) {
      return respond(encodeVerifyResponse())
    }
    if (url.endsWith("/spark.SparkService/query_nodes")) {
      const request = decodeFields(Uint8Array.from(init.body).subarray(5))
      const nodeIdsField = firstField(request, 2)
      if (!nodeIdsField?.bytes) {
        return respond(encodeQueryNodesResponse(ownerQueryNodes))
      }
      const requestedIds = decodeFields(nodeIdsField.bytes).map((f) =>
        Buffer.from(f.bytes ?? []).toString("utf8"),
      )
      byIdRequests.push(requestedIds)
      const found = requestedIds
        .map((id) => byIdNodes[id])
        .filter((n): n is TestNode => Boolean(n))
      return respond(encodeQueryNodesResponse(found))
    }
    throw new Error(`unexpected url: ${url}`)
  }) as unknown as typeof fetch

  return { byIdRequests }
}

describe("findMissingAncestors", () => {
  const node = (id: string, parentNodeId?: string): DecodedTreeNode => ({
    id,
    valueSats: 1n,
    parentNodeId,
    ownerIdentityPublicKey: new Uint8Array(0),
    status: "AVAILABLE",
    treenodeStatus: 1,
    raw: new Uint8Array(0),
  })

  it("returns ids of referenced-but-absent parents", () => {
    const leaf = node("leaf", "mid")
    const nodes = new Map([
      ["leaf", leaf],
      ["mid", node("mid", "root")],
    ])
    expect(findMissingAncestors([leaf], nodes)).toEqual(["root"])
  })

  it("returns empty when every chain reaches a root", () => {
    const leaf = node("leaf", "root")
    const nodes = new Map([
      ["leaf", leaf],
      ["root", node("root")],
    ])
    expect(findMissingAncestors([leaf], nodes)).toEqual([])
  })
})

describe("fetchRecoveryBundle", () => {
  const owner = () =>
    Uint8Array.from(deriveIdentityKeyPair(TEST_MNEMONIC, Network.Mainnet).publicKey)
  const otherOwner = Uint8Array.from(Buffer.alloc(33, 0x03))

  it("assembles a bundle, re-fetching the root omitted by the owner query", async () => {
    const identity = owner()
    const leaf: TestNode = {
      id: "leaf-1",
      valueSats: 32768,
      parentNodeId: "mid-1",
      owner: identity,
      available: true,
    }
    const mid: TestNode = {
      id: "mid-1",
      valueSats: 65536,
      parentNodeId: "root-1",
      owner: otherOwner,
      available: false,
    }
    const root: TestNode = {
      id: "root-1",
      valueSats: 100000,
      owner: otherOwner,
      available: false,
    }

    // Owner query omits the tree root (the legacy-tree operator bug)
    const { byIdRequests } = mockOperator({
      ownerQueryNodes: [leaf, mid],
      byIdNodes: { "root-1": root },
    })

    const bundle = await fetchRecoveryBundle({
      mnemonic: TEST_MNEMONIC,
      network: Network.Mainnet,
      appVersion: "1.0.1-test",
    })

    expect(byIdRequests).toEqual([["root-1"]])
    expect(bundle.schema).toBe(RECOVERY_BUNDLE_SCHEMA)
    expect(bundle.network).toBe("MAINNET")
    expect(bundle.walletIdentityPublicKey).toBe(Buffer.from(identity).toString("hex"))
    expect(bundle.leaves).toHaveLength(1)
    expect(bundle.leaves[0]).toMatchObject({
      id: "leaf-1",
      status: "AVAILABLE",
      valueSats: 32768,
    })
    expect(bundle.leaves[0].treeNodeHex).toBe(
      Buffer.from(encodeTreeNode(leaf)).toString("hex"),
    )
    expect(bundle.nodes.map((n) => n.id)).toEqual(["leaf-1", "mid-1", "root-1"])
    expect(bundle.balances.btcSats).toBe("32768")
  })

  it("refuses to build a bundle with an open exit chain", async () => {
    const identity = owner()
    const leaf: TestNode = {
      id: "leaf-1",
      valueSats: 1000,
      parentNodeId: "root-1",
      owner: identity,
      available: true,
    }
    mockOperator({ ownerQueryNodes: [leaf], byIdNodes: {} })

    await expect(
      fetchRecoveryBundle({
        mnemonic: TEST_MNEMONIC,
        network: Network.Mainnet,
        appVersion: "1.0.1-test",
      }),
    ).rejects.toMatchObject({ reason: "incomplete-chain" })
  })

  it("errors when the wallet has no available leaves", async () => {
    mockOperator({ ownerQueryNodes: [], byIdNodes: {} })

    await expect(
      fetchRecoveryBundle({
        mnemonic: TEST_MNEMONIC,
        network: Network.Mainnet,
        appVersion: "1.0.1-test",
      }),
    ).rejects.toBeInstanceOf(RecoveryBundleExportError)
  })

  it("excludes leaves owned by other identities", async () => {
    const identity = owner()
    const mine: TestNode = {
      id: "leaf-mine",
      valueSats: 100,
      owner: identity,
      available: true,
    }
    const theirs: TestNode = {
      id: "leaf-theirs",
      valueSats: 999,
      owner: otherOwner,
      available: true,
    }
    mockOperator({ ownerQueryNodes: [mine, theirs], byIdNodes: {} })

    const bundle = await fetchRecoveryBundle({
      mnemonic: TEST_MNEMONIC,
      network: Network.Mainnet,
      appVersion: "1.0.1-test",
    })
    expect(bundle.leaves.map((l) => l.id)).toEqual(["leaf-mine"])
    expect(bundle.balances.btcSats).toBe("100")
  })
})
