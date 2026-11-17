import {
  resolveAccountKey,
  resolveSessionKey,
} from "@app/store/persistent-state/account-key"
import { DefaultAccountId } from "@app/types/wallet"

const TOKEN = "session-token-a"

describe("resolveAccountKey", () => {
  it("falls back to the custodial slot while no profile id is saved", () => {
    expect(resolveAccountKey({ activeAccountId: undefined })).toBe(
      DefaultAccountId.Custodial,
    )
  })

  it("keeps the active profile's id", () => {
    expect(resolveAccountKey({ activeAccountId: "self-custodial-1" })).toBe(
      "self-custodial-1",
    )
  })
})

describe("resolveSessionKey", () => {
  it("keeps no credential: the token is digested, not kept", () => {
    const key = resolveSessionKey({ galoyAuthToken: TOKEN, activeAccountId: undefined })

    expect(key).not.toContain(TOKEN)
    expect(key).toMatch(/^[0-9a-f]{64}:/)
  })

  /** The client treats a profile id never saved and the custodial default alike. */
  it("is the same session before and after the custodial profile id is first saved", () => {
    expect(resolveSessionKey({ galoyAuthToken: TOKEN, activeAccountId: undefined })).toBe(
      resolveSessionKey({
        galoyAuthToken: TOKEN,
        activeAccountId: DefaultAccountId.Custodial,
      }),
    )
  })

  /** A self-custodial profile keeps the custodial token stored while it is active. */
  it("tells profiles apart under the same stored token", () => {
    expect(
      resolveSessionKey({ galoyAuthToken: TOKEN, activeAccountId: "self-custodial-1" }),
    ).not.toBe(resolveSessionKey({ galoyAuthToken: TOKEN, activeAccountId: undefined }))
  })

  it("tells sessions apart by their token", () => {
    expect(
      resolveSessionKey({ galoyAuthToken: TOKEN, activeAccountId: undefined }),
    ).not.toBe(
      resolveSessionKey({
        galoyAuthToken: "session-token-b",
        activeAccountId: undefined,
      }),
    )
  })
})
