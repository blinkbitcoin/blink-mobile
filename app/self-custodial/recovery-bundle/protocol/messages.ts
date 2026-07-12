/**
 * Encoders/decoders for the Spark operator messages used by the recovery
 * bundle exporter. Field numbers mirror spark.proto / spark_authn.proto in the
 * Spark SDK. Only the fields the exporter reads are decoded; TreeNodes keep
 * their raw wire bytes so the bundle stores them exactly as the operator sent
 * them (including fields this client does not model).
 */

import { decodeFields, firstField, ProtoWriter, utf8Decode, WireType } from "./wire"

/** spark.proto `Network` enum values (proto, not the Breez SDK enum). */
export const SparkProtoNetwork = {
  Mainnet: 1,
  Regtest: 2,
  Testnet: 3,
  Signet: 4,
} as const

export type SparkProtoNetwork = (typeof SparkProtoNetwork)[keyof typeof SparkProtoNetwork]

/** spark.proto `TreeNodeStatus.TREE_NODE_STATUS_AVAILABLE`. */
export const TREE_NODE_STATUS_AVAILABLE = 1

// --- spark_authn.SparkAuthnService ---

export const encodeGetChallengeRequest = (publicKey: Uint8Array): Uint8Array =>
  new ProtoWriter().bytes(1, publicKey).finish()

export type DecodedChallenge = {
  version: number
  timestamp: bigint
  nonce: Uint8Array
  publicKey: Uint8Array
}

export type DecodedProtectedChallenge = {
  /** Raw ProtectedChallenge bytes as received; echoed back in verify_challenge. */
  raw: Uint8Array
  challenge: DecodedChallenge
}

const decodeChallenge = (data: Uint8Array): DecodedChallenge => {
  const fields = decodeFields(data)
  return {
    version: Number(firstField(fields, 1)?.varint ?? 0n),
    timestamp: firstField(fields, 2)?.varint ?? 0n,
    nonce: firstField(fields, 3)?.bytes ?? new Uint8Array(0),
    publicKey: firstField(fields, 4)?.bytes ?? new Uint8Array(0),
  }
}

/**
 * Canonical re-encoding of the challenge, reproducing what the server signs
 * against: fields in tag order with proto3 default elision. Both the official
 * TS SDK and the Rust SDK sign a re-encoded challenge rather than raw bytes.
 */
export const encodeChallenge = (challenge: DecodedChallenge): Uint8Array =>
  new ProtoWriter()
    .varint(1, challenge.version)
    .varint(2, challenge.timestamp)
    .bytes(3, challenge.nonce)
    .bytes(4, challenge.publicKey)
    .finish()

export const decodeGetChallengeResponse = (
  data: Uint8Array,
): DecodedProtectedChallenge => {
  const protectedField = firstField(decodeFields(data), 1)
  if (!protectedField?.bytes) {
    throw new Error("spark auth: response has no protected_challenge")
  }
  const challengeField = firstField(decodeFields(protectedField.bytes), 2)
  if (!challengeField?.bytes) {
    throw new Error("spark auth: protected_challenge has no challenge")
  }
  return {
    raw: protectedField.bytes,
    challenge: decodeChallenge(challengeField.bytes),
  }
}

type VerifyChallengeParams = {
  protectedChallengeRaw: Uint8Array
  signatureDer: Uint8Array
  publicKey: Uint8Array
}

export const encodeVerifyChallengeRequest = ({
  protectedChallengeRaw,
  signatureDer,
  publicKey,
}: VerifyChallengeParams): Uint8Array =>
  new ProtoWriter()
    .bytes(1, protectedChallengeRaw)
    .bytes(2, signatureDer)
    .bytes(3, publicKey)
    .finish()

export type VerifyChallengeResponse = {
  sessionToken: string
  expirationTimestamp: bigint
}

export const decodeVerifyChallengeResponse = (
  data: Uint8Array,
): VerifyChallengeResponse => {
  const fields = decodeFields(data)
  const token = firstField(fields, 1)?.bytes
  if (!token || token.length === 0) {
    throw new Error("spark auth: verify_challenge returned no session token")
  }
  return {
    sessionToken: utf8Decode(token),
    expirationTimestamp: firstField(fields, 2)?.varint ?? 0n,
  }
}

// --- spark.SparkService/query_nodes ---

type QueryNodesBase = {
  includeParents: boolean
  limit: number
  offset: number
  network: SparkProtoNetwork
}

export type QueryNodesRequest = QueryNodesBase &
  ({ ownerIdentityPublicKey: Uint8Array } | { nodeIds: string[] })

export const encodeQueryNodesRequest = (request: QueryNodesRequest): Uint8Array => {
  const writer = new ProtoWriter()
  if ("ownerIdentityPublicKey" in request) {
    writer.bytes(1, request.ownerIdentityPublicKey)
  } else {
    const nodeIds = new ProtoWriter()
    for (const id of request.nodeIds) nodeIds.string(1, id)
    writer.bytes(2, nodeIds.finish())
  }
  return writer
    .bool(3, request.includeParents)
    .varint(4, request.limit)
    .varint(5, request.offset)
    .varint(6, request.network)
    .finish()
}

export type DecodedTreeNode = {
  id: string
  valueSats: bigint
  parentNodeId: string | undefined
  ownerIdentityPublicKey: Uint8Array
  /** Legacy string status, e.g. "AVAILABLE". */
  status: string
  /** Typed TreeNodeStatus enum; 1 = AVAILABLE. */
  treenodeStatus: number
  /** Raw TreeNode wire bytes exactly as received. */
  raw: Uint8Array
}

const decodeTreeNode = (data: Uint8Array): DecodedTreeNode => {
  const fields = decodeFields(data)
  const parent = firstField(fields, 4)?.bytes
  return {
    id: utf8Decode(firstField(fields, 1)?.bytes ?? new Uint8Array(0)),
    valueSats: firstField(fields, 3)?.varint ?? 0n,
    parentNodeId: parent && parent.length > 0 ? utf8Decode(parent) : undefined,
    ownerIdentityPublicKey: firstField(fields, 9)?.bytes ?? new Uint8Array(0),
    status: utf8Decode(firstField(fields, 11)?.bytes ?? new Uint8Array(0)),
    treenodeStatus: Number(firstField(fields, 19)?.varint ?? 0n),
    raw: data,
  }
}

export type QueryNodesResponse = {
  nodes: Map<string, DecodedTreeNode>
  offset: bigint
}

export const decodeQueryNodesResponse = (data: Uint8Array): QueryNodesResponse => {
  const nodes = new Map<string, DecodedTreeNode>()
  let offset = 0n

  for (const field of decodeFields(data)) {
    if (field.fieldNumber === 2 && field.wireType === WireType.Varint) {
      offset = BigInt.asIntN(64, field.varint ?? 0n)
    } else if (field.fieldNumber === 1 && field.bytes) {
      // map<string, TreeNode> entry: key = 1, value = 2
      const entryFields = decodeFields(field.bytes)
      const key = firstField(entryFields, 1)?.bytes
      const value = firstField(entryFields, 2)?.bytes
      if (key && value) nodes.set(utf8Decode(key), decodeTreeNode(value))
    }
  }

  return { nodes, offset }
}
