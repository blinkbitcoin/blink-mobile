import {
  getStablesatsTransferBlocked,
  withStablesatsTransferBlocked,
} from "@app/store/persistent-state/stablesats-transfer-block"
import { PersistentState } from "@app/store/persistent-state/state-migrations"

const baseState: PersistentState = {
  schemaVersion: 14,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("getStablesatsTransferBlocked", () => {
  it("returns false as the default", () => {
    expect(getStablesatsTransferBlocked(baseState)).toBe(false)
  })

  it("returns true once the flag is set", () => {
    expect(
      getStablesatsTransferBlocked({ ...baseState, stablesatsTransferBlocked: true }),
    ).toBe(true)
  })
})

describe("withStablesatsTransferBlocked", () => {
  it("sets the flag", () => {
    expect(withStablesatsTransferBlocked(baseState).stablesatsTransferBlocked).toBe(true)
  })

  it("keeps the flag set when already blocked", () => {
    expect(
      withStablesatsTransferBlocked({
        ...baseState,
        stablesatsTransferBlocked: true,
      }).stablesatsTransferBlocked,
    ).toBe(true)
  })

  it("does not mutate the input state", () => {
    const original: PersistentState = { ...baseState }
    const snapshot = JSON.parse(JSON.stringify(original))

    withStablesatsTransferBlocked(original)

    expect(original).toEqual(snapshot)
  })
})
