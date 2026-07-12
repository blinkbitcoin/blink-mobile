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
  /**
   * Which availability field(s) the encoded node carries. Default: both.
   * "string-only" omits field 19 (a missing varint decodes to 0, not
   * AVAILABLE=1); "enum-only" omits field 11 (a missing string decodes to ""),
   * so each variant is a genuinely single-signal fixture.
   */
  statusSignal?: "string-only" | "enum-only"
}

const encodeTreeNode = (node: TestNode): Uint8Array => {
  const writer = new ProtoWriter()
    .string(1, node.id)
    .string(2, "tree-1")
    .varint(3, node.valueSats)
  if (node.parentNodeId) writer.string(4, node.parentNodeId)
  writer.bytes(9, node.owner)
  if (node.statusSignal !== "enum-only") {
    writer.string(11, node.available ? "AVAILABLE" : "SPLITTED")
  }
  if (node.statusSignal !== "string-only") {
    writer.varint(19, node.available ? 1 : 5)
  }
  return writer.finish()
}

const encodeQueryNodesResponse = (nodes: TestNode[], offset = 0): Uint8Array => {
  const writer = new ProtoWriter()
  for (const node of nodes) {
    writer.bytes(
      1,
      new ProtoWriter().string(1, node.id).bytes(2, encodeTreeNode(node)).finish(),
    )
  }
  // offset omitted (0) terminates the exporter's paging loop; a positive
  // offset (field 2 varint, mirroring decodeQueryNodesResponse) signals
  // another page
  return writer.varint(2, offset).finish()
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

type OwnerQueryPage = { nodes: TestNode[]; offset: number }

/** Mounts a fake operator behind global.fetch. */
const mockOperator = ({
  ownerQueryNodes,
  ownerQueryPage,
  byIdNodes,
}: {
  ownerQueryNodes?: TestNode[]
  /** Per-request owner-query pages, keyed by the offset the request carried. */
  ownerQueryPage?: (requestOffset: number) => OwnerQueryPage
  byIdNodes: Record<string, TestNode>
}) => {
  const byIdRequests: string[][] = []
  const ownerQueryOffsets: number[] = []

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
        const requestOffset = Number(firstField(request, 5)?.varint ?? 0n)
        ownerQueryOffsets.push(requestOffset)
        const page = ownerQueryPage
          ? ownerQueryPage(requestOffset)
          : { nodes: ownerQueryNodes ?? [], offset: 0 }
        return respond(encodeQueryNodesResponse(page.nodes, page.offset))
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

  return { byIdRequests, ownerQueryOffsets }
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
  let identity: Uint8Array
  beforeAll(async () => {
    const keyPair = await deriveIdentityKeyPair(TEST_MNEMONIC, Network.Mainnet)
    identity = Uint8Array.from(keyPair.publicKey)
  })
  const otherOwner = Uint8Array.from(Buffer.alloc(33, 0x03))

  it("assembles a bundle, re-fetching the root omitted by the owner query", async () => {
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

  it("excludes own leaves that are not AVAILABLE", async () => {
    const available: TestNode = {
      id: "leaf-available",
      valueSats: 700,
      owner: identity,
      available: true,
    }
    const splitted: TestNode = {
      id: "leaf-splitted",
      valueSats: 999,
      owner: identity,
      available: false,
    }
    mockOperator({ ownerQueryNodes: [available, splitted], byIdNodes: {} })

    const bundle = await fetchRecoveryBundle({
      mnemonic: TEST_MNEMONIC,
      network: Network.Mainnet,
      appVersion: "1.0.1-test",
    })
    expect(bundle.leaves.map((l) => l.id)).toEqual(["leaf-available"])
    expect(bundle.balances.btcSats).toBe("700")
  })

  it("accepts leaves signalled by only the legacy status string or only the status enum", async () => {
    // Carries "AVAILABLE" in field 11 only; field 19 is absent and decodes
    // to 0, which is NOT TREE_NODE_STATUS_AVAILABLE.
    const stringOnly: TestNode = {
      id: "leaf-string-only",
      valueSats: 100,
      owner: identity,
      available: true,
      statusSignal: "string-only",
    }
    // Carries treenodeStatus 1 in field 19 only; field 11 is absent and
    // decodes to "", which is not "AVAILABLE".
    const enumOnly: TestNode = {
      id: "leaf-enum-only",
      valueSats: 200,
      owner: identity,
      available: true,
      statusSignal: "enum-only",
    }
    mockOperator({ ownerQueryNodes: [stringOnly, enumOnly], byIdNodes: {} })

    const bundle = await fetchRecoveryBundle({
      mnemonic: TEST_MNEMONIC,
      network: Network.Mainnet,
      appVersion: "1.0.1-test",
    })

    // Both halves of the availability OR must admit a leaf on their own.
    expect(bundle.leaves.map((l) => l.id)).toEqual(["leaf-enum-only", "leaf-string-only"])
    expect(bundle.balances.btcSats).toBe("300")
    // The enum-only leaf has an empty status string; the bundle backfills the
    // human-readable status from the enum.
    expect(bundle.leaves.map((l) => l.status)).toEqual(["AVAILABLE", "AVAILABLE"])
  })

  it("pages through the owner query until the operator returns offset 0", async () => {
    const pageOneLeaf: TestNode = {
      id: "leaf-page-1",
      valueSats: 100,
      owner: identity,
      available: true,
    }
    const pageTwoLeaf: TestNode = {
      id: "leaf-page-2",
      valueSats: 200,
      owner: identity,
      available: true,
    }

    // Positive response offset means more pages; 0 means this page is the last
    const { ownerQueryOffsets } = mockOperator({
      ownerQueryPage: (requestOffset) =>
        requestOffset === 0
          ? { nodes: [pageOneLeaf], offset: 100 }
          : { nodes: [pageTwoLeaf], offset: 0 },
      byIdNodes: {},
    })

    const bundle = await fetchRecoveryBundle({
      mnemonic: TEST_MNEMONIC,
      network: Network.Mainnet,
      appVersion: "1.0.1-test",
    })

    expect(ownerQueryOffsets).toEqual([0, 100])
    expect(bundle.leaves.map((l) => l.id)).toEqual(["leaf-page-1", "leaf-page-2"])
    expect(bundle.balances.btcSats).toBe("300")
  })

  it("rejects when a hostile operator never terminates the owner query", async () => {
    const leaf: TestNode = {
      id: "leaf-endless",
      valueSats: 1,
      owner: identity,
      available: true,
    }
    // Every page is non-empty with a positive offset, promising more forever
    mockOperator({
      ownerQueryPage: () => ({ nodes: [leaf], offset: 100 }),
      byIdNodes: {},
    })

    await expect(
      fetchRecoveryBundle({
        mnemonic: TEST_MNEMONIC,
        network: Network.Mainnet,
        appVersion: "1.0.1-test",
      }),
    ).rejects.toMatchObject({ reason: "paging-limit-exceeded" })
  })

  it("resolves ancestors that themselves need a second by-id round", async () => {
    const leaf: TestNode = {
      id: "leaf-1",
      valueSats: 4096,
      parentNodeId: "mid-1",
      owner: identity,
      available: true,
    }
    const mid: TestNode = {
      id: "mid-1",
      valueSats: 8192,
      parentNodeId: "root-1",
      owner: otherOwner,
      available: false,
    }
    const root: TestNode = {
      id: "root-1",
      valueSats: 16384,
      owner: otherOwner,
      available: false,
    }

    // Owner query omits both ancestors; the refetched mid reveals a missing
    // root, so closing the chain takes a second by-id round
    const { byIdRequests } = mockOperator({
      ownerQueryNodes: [leaf],
      byIdNodes: { "mid-1": mid, "root-1": root },
    })

    const bundle = await fetchRecoveryBundle({
      mnemonic: TEST_MNEMONIC,
      network: Network.Mainnet,
      appVersion: "1.0.1-test",
    })

    expect(byIdRequests).toEqual([["mid-1"], ["root-1"]])
    expect(bundle.leaves.map((l) => l.id)).toEqual(["leaf-1"])
    expect(bundle.nodes.map((n) => n.id)).toEqual(["leaf-1", "mid-1", "root-1"])
  })

  it("tolerates a truncated by-id round and completes on the next one", async () => {
    const leafA: TestNode = {
      id: "leaf-a",
      valueSats: 100,
      parentNodeId: "mid-a",
      owner: identity,
      available: true,
    }
    const leafB: TestNode = {
      id: "leaf-b",
      valueSats: 200,
      parentNodeId: "mid-b",
      owner: identity,
      available: true,
    }
    const midA: TestNode = {
      id: "mid-a",
      valueSats: 300,
      owner: otherOwner,
      available: false,
    }
    const midB: TestNode = {
      id: "mid-b",
      valueSats: 400,
      owner: otherOwner,
      available: false,
    }

    // The first by-id round returns a strict subset of what was requested
    // (mid-a but not mid-b), as if the response were truncated by the
    // operator's limit; the round made progress, so the exporter must retry
    // instead of refusing the bundle.
    let midBLookups = 0
    const byIdNodes = new Proxy<Record<string, TestNode>>(
      { "mid-a": midA },
      {
        get: (target, id) => {
          if (id === "mid-b") {
            midBLookups += 1
            return midBLookups > 1 ? midB : undefined
          }
          return target[id as string]
        },
      },
    )
    const { byIdRequests } = mockOperator({ ownerQueryNodes: [leafA, leafB], byIdNodes })

    const bundle = await fetchRecoveryBundle({
      mnemonic: TEST_MNEMONIC,
      network: Network.Mainnet,
      appVersion: "1.0.1-test",
    })

    expect(byIdRequests).toEqual([["mid-a", "mid-b"], ["mid-b"]])
    expect(bundle.nodes.map((n) => n.id)).toEqual(["leaf-a", "leaf-b", "mid-a", "mid-b"])
    expect(bundle.balances.btcSats).toBe("300")
  })
})
