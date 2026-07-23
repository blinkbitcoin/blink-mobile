import {
  buildMigrationProofChallenge,
  currentProofTimestamp,
} from "@app/screens/account-migration/utils/migration-proof"

describe("buildMigrationProofChallenge", () => {
  /**
   * Byte-for-byte the string the backend hashes before verifying the signature, so this
   * asserts the literal rather than rebuilding it from the same parts: a test that
   * mirrors the implementation would pass through any drift that breaks the proof.
   */
  it("builds the exact string the backend hashes", () => {
    const challenge = buildMigrationProofChallenge({
      custodialAccountId: "custodial-1",
      sparkPubkey: "03abc",
      timestamp: 1700000000,
    })

    expect(challenge).toBe("migrate:custodial-1-03abc-1700000000")
  })
})

describe("currentProofTimestamp", () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  /** Unix SECONDS. A millisecond value always reads as stale to the backend, whose
   *  freshness window is ten minutes either side. */
  it("stamps the proof in whole seconds", () => {
    jest.useFakeTimers({ now: 1_700_000_000_987 })

    expect(currentProofTimestamp()).toBe(1_700_000_000)
  })
})
