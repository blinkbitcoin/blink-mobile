import { isMigrationRoute } from "@app/navigation/migration-routes"

describe("isMigrationRoute", () => {
  it("recognises the deeplink entry the armed gate lets through", () => {
    expect(isMigrationRoute("accountMigrationEntry")).toBe(true)
  })

  it("recognises the screens the armed gate opens itself, which the entry alone missed", () => {
    /** Where a gate resuming a locked migration actually sends the user: a checkpoint step,
     *  or contact support when there is nothing to resume. Coverage of every registered
     *  screen is anchored on the navigator source, in migration-flow-registration.spec. */
    expect(isMigrationRoute("accountMigrationContactSupport")).toBe(true)
    expect(isMigrationRoute("accountMigrationTransferringFunds")).toBe(true)
  })

  it("rejects the screens the armed-gate reset exists to pop", () => {
    expect(isMigrationRoute("Primary")).toBe(false)
    expect(isMigrationRoute("scanningQRCode")).toBe(false)
    expect(isMigrationRoute("conversionDetails")).toBe(false)
  })

  it("rejects the unlock routes, which must never be preserved above the blocker", () => {
    expect(isMigrationRoute("authenticationCheck")).toBe(false)
    expect(isMigrationRoute("authentication")).toBe(false)
    expect(isMigrationRoute("pin")).toBe(false)
  })
})
