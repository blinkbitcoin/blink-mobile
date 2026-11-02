import { it } from "@jest/globals"

import {
  decodeGetChallengeResponse,
  decodeQueryNodesResponse,
  decodeVerifyChallengeResponse,
  encodeChallenge,
  encodeGetChallengeRequest,
  encodeQueryNodesRequest,
  encodeVerifyChallengeRequest,
  SparkProtoNetwork,
} from "@app/self-custodial/recovery-bundle/protocol/messages"
import {
  decodeFields,
  lastField,
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
    expect(Buffer.from(lastField(fields, 1)?.bytes ?? [])).toEqual(Buffer.from(publicKey))
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

  it("encodes verify_challenge request with challenge, signature and key in fields 1-3", () => {
    // Field numbers mirror spark_authn.proto; nothing else in the suite pins
    // them, so a swapped field would otherwise only fail against the real
    // coordinator.
    const protectedChallengeRaw = Uint8Array.from(Buffer.alloc(16, 0x0a))
    const signatureDer = Uint8Array.from(Buffer.alloc(70, 0x0b))
    const publicKey = Uint8Array.from(Buffer.alloc(33, 0x02))

    const fields = decodeFields(
      encodeVerifyChallengeRequest({ protectedChallengeRaw, signatureDer, publicKey }),
    )

    expect(Buffer.from(lastField(fields, 1)?.bytes ?? [])).toEqual(
      Buffer.from(protectedChallengeRaw),
    )
    expect(Buffer.from(lastField(fields, 2)?.bytes ?? [])).toEqual(
      Buffer.from(signatureDer),
    )
    expect(Buffer.from(lastField(fields, 3)?.bytes ?? [])).toEqual(Buffer.from(publicKey))
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

  it("defaults a missing verify_challenge expiration to zero", () => {
    const response = new ProtoWriter().string(1, "session-token").finish()
    expect(decodeVerifyChallengeResponse(response).expirationTimestamp).toBe(0n)
  })

  it("throws when get_challenge returns no protected_challenge", () => {
    expect(() => decodeGetChallengeResponse(new Uint8Array(0))).toThrow(
      /no protected_challenge/,
    )
  })

  it("throws when the protected_challenge carries no inner challenge", () => {
    const protectedChallenge = new ProtoWriter().varint(1, 1).finish()
    const response = new ProtoWriter().bytes(1, protectedChallenge).finish()
    expect(() => decodeGetChallengeResponse(response)).toThrow(/has no challenge/)
  })

  it("decodes absent challenge fields to the proto3 defaults it re-encodes from", () => {
    const challengeBytes = new ProtoWriter()
      .bytes(4, Uint8Array.from(Buffer.alloc(33, 0x02)))
      .finish()
    const response = new ProtoWriter()
      .bytes(1, new ProtoWriter().bytes(2, challengeBytes).finish())
      .finish()

    const { challenge } = decodeGetChallengeResponse(response)

    expect(challenge.version).toBe(0)
    expect(challenge.timestamp).toBe(0n)
    expect(challenge.nonce).toHaveLength(0)
    expect(Buffer.from(encodeChallenge(challenge))).toEqual(Buffer.from(challengeBytes))
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
    expect(Buffer.from(lastField(fields, 1)?.bytes ?? [])).toEqual(Buffer.from(owner))
    expect(lastField(fields, 3)?.varint).toBe(1n)
    expect(lastField(fields, 4)?.varint).toBe(100n)
    expect(lastField(fields, 5)?.varint).toBe(200n)
    expect(lastField(fields, 6)?.varint).toBe(1n)
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
    const nodeIdFields = decodeFields(lastField(fields, 2)?.bytes ?? new Uint8Array(0))
    expect(nodeIdFields.map((f) => utf8Decode(f.bytes ?? new Uint8Array(0)))).toEqual([
      "a",
      "b",
    ])
    expect(lastField(fields, 1)).toBeUndefined()
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

  it("decodes absent TreeNode fields to proto3 defaults", () => {
    const treeNode = new ProtoWriter().string(1, "leaf-1").finish()
    const entry = new ProtoWriter().string(1, "leaf-1").bytes(2, treeNode).finish()

    const node = decodeQueryNodesResponse(
      new ProtoWriter().bytes(1, entry).finish(),
    ).nodes.get("leaf-1")

    expect(node).toMatchObject({
      valueSats: 0n,
      parentNodeId: undefined,
      status: "",
      treenodeStatus: 0,
    })
    expect(node?.ownerIdentityPublicKey).toHaveLength(0)
  })

  const treeNodeWithId = (id: string) =>
    new ProtoWriter().string(1, id).varint(3, 1000).finish()

  it.each([
    {
      name: "names a different node",
      entry: new ProtoWriter()
        .string(1, "root-A")
        .bytes(2, treeNodeWithId("root-B"))
        .finish(),
    },
    {
      name: "is missing",
      entry: new ProtoWriter().bytes(2, treeNodeWithId("root-B")).finish(),
    },
    {
      name: "maps a node without an id",
      entry: new ProtoWriter()
        .string(1, "root-A")
        .bytes(2, new ProtoWriter().varint(3, 1000).finish())
        .finish(),
    },
    { name: "maps no node", entry: new ProtoWriter().string(1, "root-A").finish() },
  ])("refuses a map entry whose key $name", ({ entry }) => {
    const response = new ProtoWriter().bytes(1, entry).finish()
    expect(() => decodeQueryNodesResponse(response)).toThrow(/does not match node id/)
  })
})
