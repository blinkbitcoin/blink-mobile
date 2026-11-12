import { statusUnrecognisedSupport } from "@app/screens/account-migration/utils/server-migration-flow"
import { MigrationSupportOrigin, MigrationSupportReason } from "@app/types/migration"

describe("statusUnrecognisedSupport", () => {
  it("hands over naming the custodial account the checkpoint was saved under", () => {
    expect(statusUnrecognisedSupport("custodial-1")).toEqual({
      reason: MigrationSupportReason.StatusUnrecognised,
      origin: MigrationSupportOrigin.Resume,
      custodialAccountId: "custodial-1",
    })
  })

  it("leaves the account to the support screen's own lookup when no owner was saved", () => {
    expect(statusUnrecognisedSupport(null)).toEqual({
      reason: MigrationSupportReason.StatusUnrecognised,
      origin: MigrationSupportOrigin.Resume,
      custodialAccountId: undefined,
    })
  })
})
