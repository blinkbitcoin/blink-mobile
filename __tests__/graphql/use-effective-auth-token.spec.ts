import { renderHook } from "@testing-library/react-native"

import { useEffectiveAuthToken } from "@app/graphql/use-effective-auth-token"
import { DefaultAccountId } from "@app/types/wallet.types"

let mockToken = "live-token"
let mockActiveAccountId: string | undefined

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: { token: mockToken, galoyInstance: { id: "Main" } },
  }),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: { activeAccountId: mockActiveAccountId, galoyAuthToken: mockToken },
  }),
}))

describe("useEffectiveAuthToken", () => {
  beforeEach(() => {
    mockToken = "live-token"
    mockActiveAccountId = undefined
  })

  it("returns the live token when no active account is set", () => {
    const { result } = renderHook(() => useEffectiveAuthToken())

    expect(result.current).toBe("live-token")
  })

  it("returns the live token when active account is custodial", () => {
    mockActiveAccountId = DefaultAccountId.Custodial

    const { result } = renderHook(() => useEffectiveAuthToken())

    expect(result.current).toBe("live-token")
  })

  it("returns an empty token when active account is self-custodial", () => {
    mockActiveAccountId = "sc-uuid-1"

    const { result } = renderHook(() => useEffectiveAuthToken())

    expect(result.current).toBe("")
  })

  it("returns an empty token even if a custodial token is still saved", () => {
    // The architectural guarantee: self-custodial mode never lets the live
    // custodial token reach the Apollo client, regardless of whether the
    // KeyStore still holds it for later restore.
    mockToken = "still-saved-custodial"
    mockActiveAccountId = "sc-uuid-1"

    const { result } = renderHook(() => useEffectiveAuthToken())

    expect(result.current).toBe("")
  })
})
