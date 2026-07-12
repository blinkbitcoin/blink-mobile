import {
  decodeGetChallengeResponse,
  decodeQueryNodesResponse,
  decodeVerifyChallengeResponse,
  encodeChallenge,
  encodeGetChallengeRequest,
  encodeQueryNodesRequest,
  SparkProtoNetwork,
} from "@app/self-custodial/recovery-bundle/protocol/messages"
import {
  decodeFields,
  firstField,
  ProtoWriter,
  utf8Decode,
} from "@app/self-custodial/recovery-bundle/protocol/wire"

const encodeTestChallenge = () =>
  new ProtoWriter()
    .varint(1, 1)
    .varint(2, 1752300000)
    .bytes(3, Uint8Array.from(Buffer.alloc(32, 0x11)))
    .bytes(4, Uint8Array.from(Buffer.alloc(33, 0x02)))
    .finish()

describe("spark auth messages", () => {
  it("encodes get_challenge request with the public key", () => {
    const publicKey = Uint8Array.from(Buffer.alloc(33, 0x03))
    const fields = decodeFields(encodeGetChallengeRequest(publicKey))
    expect(Buffer.from(firstField(fields, 1)?.bytes ?? [])).toEqual(
      Buffer.from(publicKey),
    )
  })

  it("decodes the protected challenge and re-encodes the inner challenge canonically", () => {
    const challengeBytes = encodeTestChallenge()
    const protectedChallenge = new ProtoWriter()
      .varint(1, 1)
      .bytes(2, challengeBytes)
      .bytes(3, Uint8Array.from(Buffer.alloc(32, 0xaa)))
      .finish()
    const response = new ProtoWriter().bytes(1, protectedChallenge).finish()

    const decoded = decodeGetChallengeResponse(response)
    expect(Buffer.from(decoded.raw)).toEqual(Buffer.from(protectedChallenge))
    // Canonical re-encode of the decoded challenge must be byte-identical to
    // the canonical server encoding - this is what gets signed.
    expect(Buffer.from(encodeChallenge(decoded.challenge))).toEqual(
      Buffer.from(challengeBytes),
    )
  })

  it("decodes verify_challenge response", () => {
    const response = new ProtoWriter().string(1, "session-token").varint(2, 99).finish()
    expect(decodeVerifyChallengeResponse(response)).toEqual({
      sessionToken: "session-token",
      expirationTimestamp: 99n,
    })
  })

  it("throws when verify_challenge returns no token", () => {
    expect(() => decodeVerifyChallengeResponse(new Uint8Array(0))).toThrow(
      /no session token/,
    )
  })
})

describe("query_nodes messages", () => {
  it("encodes an owner query", () => {
    const owner = Uint8Array.from(Buffer.alloc(33, 0x02))
    const fields = decodeFields(
      encodeQueryNodesRequest({
        ownerIdentityPublicKey: owner,
        includeParents: true,
        limit: 100,
        offset: 200,
        network: SparkProtoNetwork.Mainnet,
      }),
    )
    expect(Buffer.from(firstField(fields, 1)?.bytes ?? [])).toEqual(Buffer.from(owner))
    expect(firstField(fields, 3)?.varint).toBe(1n)
    expect(firstField(fields, 4)?.varint).toBe(100n)
    expect(firstField(fields, 5)?.varint).toBe(200n)
    expect(firstField(fields, 6)?.varint).toBe(1n)
  })

  it("encodes a by-node-ids query", () => {
    const fields = decodeFields(
      encodeQueryNodesRequest({
        nodeIds: ["a", "b"],
        includeParents: true,
        limit: 100,
        offset: 0,
        network: SparkProtoNetwork.Regtest,
      }),
    )
    const nodeIdFields = decodeFields(firstField(fields, 2)?.bytes ?? new Uint8Array(0))
    expect(nodeIdFields.map((f) => utf8Decode(f.bytes ?? new Uint8Array(0)))).toEqual([
      "a",
      "b",
    ])
    expect(firstField(fields, 1)).toBeUndefined()
  })

  it("decodes a nodes map and preserves raw TreeNode bytes", () => {
    const treeNode = new ProtoWriter()
      .string(1, "leaf-1")
      .string(2, "tree-1")
      .varint(3, 32768)
      .string(4, "parent-1")
      .bytes(9, Uint8Array.from(Buffer.alloc(33, 0x02)))
      .string(11, "AVAILABLE")
      .varint(19, 1)
      .finish()
    const entry = new ProtoWriter().string(1, "leaf-1").bytes(2, treeNode).finish()
    const response = new ProtoWriter().bytes(1, entry).varint(2, -1n).finish()

    const decoded = decodeQueryNodesResponse(response)
    expect(decoded.offset).toBe(-1n)
    const node = decoded.nodes.get("leaf-1")
    expect(node).toBeDefined()
    expect(node?.id).toBe("leaf-1")
    expect(node?.valueSats).toBe(32768n)
    expect(node?.parentNodeId).toBe("parent-1")
    expect(node?.status).toBe("AVAILABLE")
    expect(node?.treenodeStatus).toBe(1)
    // raw bytes preserved exactly - this is what lands in treeNodeHex
    expect(Buffer.from(node?.raw ?? [])).toEqual(Buffer.from(treeNode))
  })
})
