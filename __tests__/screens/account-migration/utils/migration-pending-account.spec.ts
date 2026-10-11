import { resolveReusablePendingAccount } from "@app/screens/account-migration/utils/migration-pending-account"

const PENDING_WALLET_ID = "sc-pending-1"
const CUSTODIAL_ID = "custodial-1"

const onDevice = [{ id: CUSTODIAL_ID }, { id: PENDING_WALLET_ID }]

describe("resolveReusablePendingAccount", () => {
  it("reuses a recorded wallet that still exists on the device", () => {
    expect(resolveReusablePendingAccount(PENDING_WALLET_ID, onDevice)).toBe(
      PENDING_WALLET_ID,
    )
  })

  /** A session that is not custodial has no owner id, so the record it would be looked up
   *  under is unreachable: nothing is reusable, which is also what keeps a locked gate from
   *  resuming onto the wallet already in use. */
  it("reuses nothing when there is no record for the active owner", () => {
    expect(resolveReusablePendingAccount(null, onDevice)).toBeNull()
  })

  /** The wiped-device signature: the record survived but its wallet did not, so a restart
   *  could only provision another orphan. */
  it("reuses nothing when the recorded wallet is gone from the device", () => {
    expect(
      resolveReusablePendingAccount(PENDING_WALLET_ID, [{ id: CUSTODIAL_ID }]),
    ).toBeNull()
  })

  it("reuses nothing when the device holds no accounts at all", () => {
    expect(resolveReusablePendingAccount(PENDING_WALLET_ID, [])).toBeNull()
  })
})
