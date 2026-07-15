import {
  getStableTokenTransferBlocked,
  withStableTokenTransferBlocked,
  withoutStableTokenTransferBlocked,
} from "@app/store/persistent-state/stable-token-transfer-block"
import { PersistentState } from "@app/store/persistent-state/state-migrations"

const baseState: PersistentState = {
  schemaVersion: 14,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("getStableTokenTransferBlocked", () => {
  it("returns false as the default", () => {
    expect(getStableTokenTransferBlocked(baseState)).toBe(false)
  })

  it("returns true once the flag is set", () => {
    expect(
      getStableTokenTransferBlocked({ ...baseState, stableTokenTransferBlocked: true }),
    ).toBe(true)
  })
})

describe("withStableTokenTransferBlocked", () => {
  it("sets the flag", () => {
    expect(withStableTokenTransferBlocked(baseState).stableTokenTransferBlocked).toBe(
      true,
    )
  })

  it("keeps the flag set when already blocked", () => {
    expect(
      withStableTokenTransferBlocked({
        ...baseState,
        stableTokenTransferBlocked: true,
      }).stableTokenTransferBlocked,
    ).toBe(true)
  })

  it("does not mutate the input state", () => {
    const original: PersistentState = { ...baseState }
    const snapshot = JSON.parse(JSON.stringify(original))

    withStableTokenTransferBlocked(original)

    expect(original).toEqual(snapshot)
  })
})

describe("withoutStableTokenTransferBlocked", () => {
  it("clears the flag when set", () => {
    expect(
      getStableTokenTransferBlocked(
        withoutStableTokenTransferBlocked(withStableTokenTransferBlocked(baseState)),
      ),
    ).toBe(false)
  })

  it("keeps the flag cleared when already unset", () => {
    expect(
      getStableTokenTransferBlocked(withoutStableTokenTransferBlocked(baseState)),
    ).toBe(false)
  })

  it("does not mutate the input state", () => {
    const original: PersistentState = { ...baseState, stableTokenTransferBlocked: true }
    const snapshot = JSON.parse(JSON.stringify(original))

    withoutStableTokenTransferBlocked(original)

    expect(original).toEqual(snapshot)
  })
})
