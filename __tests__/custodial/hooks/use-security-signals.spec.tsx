import { renderHook } from "@testing-library/react-native"

import {
  custodialSecuritySignals,
  useCustodialSecuritySignals,
} from "@app/custodial/hooks/use-security-signals"
import { AccountType } from "@app/types/wallet"

const mockActiveAccount = jest.fn()
const mockIsAuthed = jest.fn()
const mockIsAtLeastLevelOne = jest.fn()
const mockSettingsData = jest.fn()

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount() }),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockIsAuthed(),
}))

jest.mock("@app/graphql/level-context", () => ({
  useLevel: () => ({ isAtLeastLevelOne: mockIsAtLeastLevelOne() }),
}))

jest.mock("@app/graphql/generated", () => ({
  useSettingsScreenQuery: (options: { skip?: boolean }) =>
    options?.skip ? { data: undefined } : { data: mockSettingsData() },
}))

describe("custodialSecuritySignals", () => {
  it("orders account signals first and marks them inert once done", () => {
    const signals = custodialSecuritySignals({
      totpEnabled: false,
      emailVerified: false,
    })

    expect(signals.map((s) => s.key)).toEqual(["twoFactor", "emailVerified"])
    expect(signals.every((s) => !s.retriggerable)).toBe(true)
  })

  it("reflects totp and email states independently", () => {
    const signals = custodialSecuritySignals({
      totpEnabled: true,
      emailVerified: false,
    })

    expect(signals.find((s) => s.key === "twoFactor")?.done).toBe(true)
    expect(signals.find((s) => s.key === "emailVerified")?.done).toBe(false)
  })
})

describe("useCustodialSecuritySignals", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveAccount.mockReturnValue({ type: AccountType.Custodial })
    mockIsAuthed.mockReturnValue(true)
    mockIsAtLeastLevelOne.mockReturnValue(true)
    mockSettingsData.mockReturnValue({
      me: { totpEnabled: false, email: { address: null, verified: false } },
    })
  })

  it("returns null for a self-custodial account", () => {
    mockActiveAccount.mockReturnValue({ type: AccountType.SelfCustodial })

    const { result } = renderHook(() => useCustodialSecuritySignals())

    expect(result.current).toBeNull()
  })

  it("returns an empty list at level 0: device signals only, no dead Set rows", () => {
    mockIsAtLeastLevelOne.mockReturnValue(false)

    const { result } = renderHook(() => useCustodialSecuritySignals())

    expect(result.current).toEqual([])
  })

  it("marks twoFactor done from me.totpEnabled", () => {
    mockSettingsData.mockReturnValue({
      me: { totpEnabled: true, email: { address: null, verified: false } },
    })

    const { result } = renderHook(() => useCustodialSecuritySignals())

    expect(result.current?.find((s) => s.key === "twoFactor")?.done).toBe(true)
  })

  it("requires the email to be both present and verified", () => {
    mockSettingsData.mockReturnValue({
      me: { totpEnabled: false, email: { address: "a@b.c", verified: false } },
    })

    const { result } = renderHook(() => useCustodialSecuritySignals())

    expect(result.current?.find((s) => s.key === "emailVerified")?.done).toBe(false)
  })

  it("treats a verified email as done", () => {
    mockSettingsData.mockReturnValue({
      me: { totpEnabled: false, email: { address: "a@b.c", verified: true } },
    })

    const { result } = renderHook(() => useCustodialSecuritySignals())

    expect(result.current?.find((s) => s.key === "emailVerified")?.done).toBe(true)
  })

  it("skips the query and reports both signals undone when unauthed", () => {
    mockIsAuthed.mockReturnValue(false)

    const { result } = renderHook(() => useCustodialSecuritySignals())

    expect(mockSettingsData).not.toHaveBeenCalled()
    expect(result.current?.every((s) => !s.done)).toBe(true)
  })
})
