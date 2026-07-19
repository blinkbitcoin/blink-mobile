/**
 * The proof of possession the backend verifies before paying a migration out: it hashes
 * this exact string and checks the signature against the destination wallet's key, so any
 * drift here reads as a forged proof. Mirrors `buildMigrationProofChallenge` server-side.
 */
export const buildMigrationProofChallenge = ({
  custodialAccountId,
  sparkPubkey,
  timestamp,
}: {
  custodialAccountId: string
  sparkPubkey: string
  /** Unix SECONDS. The server rejects anything more than ten minutes either side. */
  timestamp: number
}): string => `migrate:${custodialAccountId}-${sparkPubkey}-${timestamp}`

/** Milliseconds per second, for the Unix-seconds timestamp the proof is stamped with. */
const MILLISECONDS_PER_SECOND = 1000

export const currentProofTimestamp = (): number =>
  Math.floor(Date.now() / MILLISECONDS_PER_SECOND)
