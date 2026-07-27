/**
 * Fetches a fresh unilateral-exit recovery bundle from the Spark operators.
 *
 * Mirrors the spark-unilateral-exit reference exporter (src/operator/):
 * authenticate to the coordinator with the seed-derived identity key, page
 * through query_nodes(owner, include_parents=true), then verify every leaf's
 * ancestor chain is closed - re-fetching missing ancestors by node id, which
 * bypasses the operators' root-skip bug on legacy mainnet trees. A bundle
 * with an open chain is unusable for exit, so incompleteness is an error,
 * not a warning.
 */

import { Network } from "@breeztech/breez-sdk-spark-react-native"

import { deriveIdentityKeyPair, signChallenge, type IdentityKeyPair } from "./identity"
import { grpcWebUnaryCall } from "./protocol/grpc-web"
import {
  decodeGetChallengeResponse,
  decodeQueryNodesResponse,
  decodeVerifyChallengeResponse,
  encodeChallenge,
  encodeGetChallengeRequest,
  encodeQueryNodesRequest,
  encodeVerifyChallengeRequest,
  SparkProtoNetwork,
  TREE_NODE_STATUS_AVAILABLE,
  type DecodedTreeNode,
} from "./protocol/messages"
import {
  RECOVERY_BUNDLE_SCHEMA,
  USDB_NOT_COVERED_STATUS,
  type RecoveryBundle,
} from "./types"

/**
 * Operator id 0 is the pool coordinator in the Spark SDK's default config.
 * The public pool coordinator serves every non-local network - the target
 * network travels in each request (see protoNetworkFor) - so mainnet and
 * regtest share this URL, same as the spark-unilateral-exit reference
 * exporter, whose --coordinator override exists only for LOCAL stacks.
 */
export const SPARK_COORDINATOR_URL = "https://0.spark.lightspark.com"
const OPERATOR_SET = "breez-sdk"

const GET_CHALLENGE_PATH = "/spark_authn.SparkAuthnService/get_challenge"
const VERIFY_CHALLENGE_PATH = "/spark_authn.SparkAuthnService/verify_challenge"
const QUERY_NODES_PATH = "/spark.SparkService/query_nodes"

const PAGE_SIZE = 100
/**
 * Overall wall-clock budget for one bundle fetch. Each gRPC call has its own
 * 30s timeout, but auth + up to MAX_OWNER_QUERY_PAGES pages + refetch rounds
 * would otherwise let a degraded network hold a background refresh for over
 * an hour; the budget caps the whole fetch instead.
 */
const TOTAL_FETCH_BUDGET_MS = 2 * 60_000
/** Chain walks converge in one refetch round; the cap only guards operator misbehavior. */
const MAX_ANCESTOR_REFETCH_ROUNDS = 10
/**
 * Upper bound on owner-query pages (200 pages x 100 nodes = 20k nodes, far
 * beyond any real wallet). Guards the same threat as the ancestor-round cap:
 * a misbehaving coordinator that keeps returning data must not keep a
 * background refresh looping forever on a phone.
 */
const MAX_OWNER_QUERY_PAGES = 200

export const RecoveryBundleExportErrorReason = {
  NoLeaves: "no-leaves",
  IncompleteChain: "incomplete-chain",
  PagingLimitExceeded: "paging-limit-exceeded",
  BudgetExceeded: "budget-exceeded",
  InvalidNode: "invalid-node",
} as const

export type RecoveryBundleExportErrorReason =
  (typeof RecoveryBundleExportErrorReason)[keyof typeof RecoveryBundleExportErrorReason]

export class RecoveryBundleExportError extends Error {
  constructor(
    readonly reason: RecoveryBundleExportErrorReason,
    message: string,
    /** Diagnostic identifiers kept out of `message` so error messages can be
     * logged (e.g. Crashlytics) without leaking the wallet identity. */
    readonly details?: { walletIdentityPublicKey?: string },
  ) {
    super(message)
    this.name = "RecoveryBundleExportError"
  }
}

const protoNetworkFor = (network: Network): SparkProtoNetwork =>
  network === Network.Mainnet ? SparkProtoNetwork.Mainnet : SparkProtoNetwork.Regtest

const bundleNetworkLabelFor = (network: Network): string =>
  network === Network.Mainnet ? "MAINNET" : "REGTEST"

/** Remaining time before `deadline`; throws BudgetExceeded when spent. */
const remainingBudgetMs = (deadline: number): number => {
  const remaining = deadline - Date.now()
  if (remaining <= 0) {
    throw new RecoveryBundleExportError(
      RecoveryBundleExportErrorReason.BudgetExceeded,
      `Recovery bundle fetch exceeded its ${TOTAL_FETCH_BUDGET_MS / 1000}s time budget`,
    )
  }
  return remaining
}

const authenticate = async (
  baseUrl: string,
  keyPair: IdentityKeyPair,
  deadline: number,
): Promise<string> => {
  const challengeResponse = await grpcWebUnaryCall({
    baseUrl,
    methodPath: GET_CHALLENGE_PATH,
    request: encodeGetChallengeRequest(keyPair.publicKey),
    timeoutMs: remainingBudgetMs(deadline),
  })
  const protectedChallenge = decodeGetChallengeResponse(challengeResponse)

  const signatureDer = signChallenge(
    encodeChallenge(protectedChallenge.challenge),
    keyPair.privateKey,
  )

  const verifyResponse = await grpcWebUnaryCall({
    baseUrl,
    methodPath: VERIFY_CHALLENGE_PATH,
    request: encodeVerifyChallengeRequest({
      protectedChallengeRaw: protectedChallenge.raw,
      signatureDer,
      publicKey: keyPair.publicKey,
    }),
    timeoutMs: remainingBudgetMs(deadline),
  })
  const { sessionToken } = decodeVerifyChallengeResponse(verifyResponse)
  return `Bearer ${sessionToken}`
}

type QueryContext = {
  baseUrl: string
  authorization: string
  network: SparkProtoNetwork
  /** Unix ms after which further operator calls throw BudgetExceeded. */
  deadline: number
}

const queryNodesByOwner = async (
  context: QueryContext,
  ownerIdentityPublicKey: Uint8Array,
): Promise<Map<string, DecodedTreeNode>> => {
  const nodes = new Map<string, DecodedTreeNode>()
  let offset = 0

  for (let page = 0; ; page += 1) {
    if (page >= MAX_OWNER_QUERY_PAGES) {
      throw new RecoveryBundleExportError(
        RecoveryBundleExportErrorReason.PagingLimitExceeded,
        `Owner query did not terminate within ${MAX_OWNER_QUERY_PAGES} pages`,
      )
    }
    const response = decodeQueryNodesResponse(
      await grpcWebUnaryCall({
        baseUrl: context.baseUrl,
        methodPath: QUERY_NODES_PATH,
        authorization: context.authorization,
        request: encodeQueryNodesRequest({
          ownerIdentityPublicKey,
          includeParents: true,
          limit: PAGE_SIZE,
          offset,
          network: context.network,
        }),
        timeoutMs: remainingBudgetMs(context.deadline),
      }),
    )
    for (const [id, node] of response.nodes) nodes.set(id, node)
    // The request offset is a skip count and the response offset only signals
    // "more pages" (semantics validated against the real operators by the
    // spark-unilateral-exit reference exporter). Advance by the number of
    // nodes actually returned, not the requested limit: a short page with a
    // positive offset would otherwise silently skip the unreturned tail, and
    // a skipped AVAILABLE leaf means an incomplete bundle saved as complete.
    if (response.nodes.size === 0 || response.offset <= 0n) break
    offset += response.nodes.size
  }

  return nodes
}

const queryNodesByIds = async (
  context: QueryContext,
  nodeIds: string[],
): Promise<Map<string, DecodedTreeNode>> => {
  const nodes = new Map<string, DecodedTreeNode>()
  for (let start = 0; start < nodeIds.length; start += PAGE_SIZE) {
    const response = decodeQueryNodesResponse(
      await grpcWebUnaryCall({
        baseUrl: context.baseUrl,
        methodPath: QUERY_NODES_PATH,
        authorization: context.authorization,
        request: encodeQueryNodesRequest({
          nodeIds: nodeIds.slice(start, start + PAGE_SIZE),
          includeParents: true,
          limit: PAGE_SIZE,
          offset: 0,
          network: context.network,
        }),
        timeoutMs: remainingBudgetMs(context.deadline),
      }),
    )
    for (const [id, node] of response.nodes) nodes.set(id, node)
  }
  return nodes
}

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((byte, i) => byte === b[i])

const isAvailableOwnerLeaf = (
  node: DecodedTreeNode,
  identityPublicKey: Uint8Array,
): boolean =>
  (node.treenodeStatus === TREE_NODE_STATUS_AVAILABLE ||
    node.status.toUpperCase() === "AVAILABLE") &&
  bytesEqual(node.ownerIdentityPublicKey, identityPublicKey)

/**
 * Node ids whose parents are referenced but absent from the map. Throws
 * IncompleteChain on a parent-pointer cycle: a chain that loops never reaches
 * a root, so the bundle would be unusable for exit even though no node is
 * "missing" - it must be refused, not classified as closed.
 */
export const findMissingAncestors = (
  leaves: DecodedTreeNode[],
  nodes: Map<string, DecodedTreeNode>,
): string[] => {
  const missing = new Set<string>()
  for (const leaf of leaves) {
    let current: DecodedTreeNode | undefined = leaf
    const visited = new Set<string>()
    while (current?.parentNodeId) {
      if (visited.has(current.id)) {
        throw new RecoveryBundleExportError(
          RecoveryBundleExportErrorReason.IncompleteChain,
          `Exit chain contains a parent cycle at node ${current.id}`,
        )
      }
      visited.add(current.id)
      const parent: DecodedTreeNode | undefined = nodes.get(current.parentNodeId)
      if (!parent) {
        missing.add(current.parentNodeId)
        break
      }
      current = parent
    }
  }
  return [...missing]
}

const hexEncode = (bytes: Uint8Array): string => Buffer.from(bytes).toString("hex")

export type FetchRecoveryBundleParams = {
  mnemonic: string
  network: Network
  appVersion: string
  accountNumber?: number
  coordinatorUrl?: string
  /** Overrides the total fetch budget; tests pin the budget mechanism with it. */
  totalBudgetMs?: number
}

export const fetchRecoveryBundle = async ({
  mnemonic,
  network,
  appVersion,
  accountNumber,
  coordinatorUrl = SPARK_COORDINATOR_URL,
  totalBudgetMs = TOTAL_FETCH_BUDGET_MS,
}: FetchRecoveryBundleParams): Promise<RecoveryBundle> => {
  const keyPair = await deriveIdentityKeyPair(mnemonic, network, accountNumber)
  const deadline = Date.now() + totalBudgetMs

  const context: QueryContext = {
    baseUrl: coordinatorUrl,
    authorization: await authenticate(coordinatorUrl, keyPair, deadline),
    network: protoNetworkFor(network),
    deadline,
  }

  const nodes = await queryNodesByOwner(context, keyPair.publicKey)
  const leaves = [...nodes.values()].filter((node) =>
    isAvailableOwnerLeaf(node, keyPair.publicKey),
  )

  // The value decodes as an unsigned varint, so a hostile encoding of a
  // negative number arrives as a near-2^64 value; either way Number(bigint)
  // would silently propagate an absurd figure into the displayed amounts.
  // 21M BTC bounds any real leaf (and stays below MAX_SAFE_INTEGER).
  const MAX_LEAF_VALUE_SATS = 2_100_000_000_000_000n
  for (const leaf of leaves) {
    if (leaf.valueSats < 0n || leaf.valueSats > MAX_LEAF_VALUE_SATS) {
      throw new RecoveryBundleExportError(
        RecoveryBundleExportErrorReason.InvalidNode,
        `Leaf ${leaf.id} carries an implausible value`,
      )
    }
  }

  if (leaves.length === 0) {
    // The identity and status histogram distinguish "wrong account derived a
    // different wallet" from "wallet genuinely empty" - the known footgun
    // this error usually means.
    const statusCounts: Record<string, number> = {}
    for (const node of nodes.values()) {
      const status = node.status || String(node.treenodeStatus)
      statusCounts[status] = (statusCounts[status] ?? 0) + 1
    }
    throw new RecoveryBundleExportError(
      RecoveryBundleExportErrorReason.NoLeaves,
      "Spark operators returned no available leaves for this wallet " +
        `(queriedNodes=${nodes.size}, statuses=${JSON.stringify(statusCounts)})`,
      { walletIdentityPublicKey: hexEncode(keyPair.publicKey) },
    )
  }

  // The bulk owner query can omit tree roots on legacy mainnet trees; by-id
  // queries do not, so re-fetch missing ancestors until every chain closes.
  // A round may itself be truncated by the response limit, so keep looping
  // while rounds make progress and only fail when one resolves nothing.
  for (let round = 0; round < MAX_ANCESTOR_REFETCH_ROUNDS; round += 1) {
    const missing = findMissingAncestors(leaves, nodes)
    if (missing.length === 0) break
    const fetched = await queryNodesByIds(context, missing)
    let progressed = false
    for (const [id, node] of fetched) {
      if (!nodes.has(id)) progressed = true
      nodes.set(id, node)
    }
    if (!progressed) {
      throw new RecoveryBundleExportError(
        RecoveryBundleExportErrorReason.IncompleteChain,
        `Exit chain incomplete: ancestors not returned by operators: ${missing.join(", ")}`,
      )
    }
  }

  const unresolved = findMissingAncestors(leaves, nodes)
  if (unresolved.length > 0) {
    throw new RecoveryBundleExportError(
      RecoveryBundleExportErrorReason.IncompleteChain,
      `Exit chain incomplete after refetch: ${unresolved.join(", ")}`,
    )
  }

  // Plain code-unit comparison, not localeCompare: node ordering must not
  // depend on the device's ICU tables so bundles stay byte-reproducible.
  const sortedByIdAsc = <T extends { id: string }>(items: T[]): T[] =>
    [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  const totalSats = leaves.reduce((sum, leaf) => sum + leaf.valueSats, 0n)

  return {
    schema: RECOVERY_BUNDLE_SCHEMA,
    createdAt: new Date().toISOString(),
    network: bundleNetworkLabelFor(network),
    operatorSet: OPERATOR_SET,
    walletIdentityPublicKey: hexEncode(keyPair.publicKey),
    sparkSdkVersion: "breez-sdk-spark-react-native",
    appVersion,
    leaves: sortedByIdAsc(leaves).map((leaf) => ({
      id: leaf.id,
      status:
        leaf.status ||
        (leaf.treenodeStatus === TREE_NODE_STATUS_AVAILABLE
          ? "AVAILABLE"
          : String(leaf.treenodeStatus)),
      // Safe: a single leaf cannot exceed 21M BTC = 2.1e15 sats, well below
      // Number.MAX_SAFE_INTEGER (~9e15); the total stays a bigint string.
      valueSats: Number(leaf.valueSats),
      treeNodeHex: hexEncode(leaf.raw),
    })),
    nodes: sortedByIdAsc([...nodes.values()]).map((node) => ({
      id: node.id,
      treeNodeHex: hexEncode(node.raw),
    })),
    balances: {
      btcSats: totalSats.toString(),
      usdb: { amount: "0.00", status: USDB_NOT_COVERED_STATUS },
    },
  }
}
