import {
  getCustodialMigrationRequired,
  withCustodialMigrationRequired,
} from "@app/store/persistent-state/custodial-migration-required"
import { PersistentState } from "@app/store/persistent-state/state-migrations"

const baseState: PersistentState = {
  schemaVersion: 14,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("getCustodialMigrationRequired", () => {
  it("returns false as the default", () => {
    expect(getCustodialMigrationRequired(baseState)).toBe(false)
  })

  it("returns true once the custodial migration flag is set", () => {
    expect(
      getCustodialMigrationRequired({ ...baseState, custodialMigrationRequired: true }),
    ).toBe(true)
  })
})

describe("withCustodialMigrationRequired", () => {
  it("sets the custodial migration flag", () => {
    const next = withCustodialMigrationRequired(baseState)

    expect(next.custodialMigrationRequired).toBe(true)
  })

  it("keeps the flag set when migration is already required", () => {
    const next = withCustodialMigrationRequired({
      ...baseState,
      custodialMigrationRequired: true,
    })

    expect(next.custodialMigrationRequired).toBe(true)
  })

  it("does not mutate the input state", () => {
    const original: PersistentState = { ...baseState }
    const snapshot = JSON.parse(JSON.stringify(original))

    withCustodialMigrationRequired(original)

    expect(original).toEqual(snapshot)
  })
})
