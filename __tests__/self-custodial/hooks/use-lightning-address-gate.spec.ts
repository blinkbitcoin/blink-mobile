import { renderHook } from "@testing-library/react-native"

import { useLightningAddressGated } from "@app/self-custodial/hooks/use-lightning-address-gate"
import {
  defaultPersistentState,
  PersistentState,
} from "@app/store/persistent-state/state-migrations"
import { AccountMode } from "@app/types/account"

/**
 * Drives the real account-mode hook off a stubbed persistent state rather than mocking
 * the mode away, so this pins the rule end to end: what is stored for the active account
 * decides whether the address is offered as a way to get paid.
 */

let mockPersistentState: PersistentState

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState,
    updateState: jest.fn(),
  }),
}))

/** Taken from the real default rather than a literal: the mode is what this spec is
 *  about, and a pinned schema version would only break on the next migration. */
const baseState: PersistentState = defaultPersistentState

const stateWithMode = (mode: AccountMode): PersistentState => ({
  ...baseState,
  activeAccountId: "self-custodial-1",
  selfCustodialAccountModeByAccountId: { "self-custodial-1": mode },
})

describe("useLightningAddressGated", () => {
  beforeEach(() => {
    mockPersistentState = { ...baseState }
  })

  it("withholds the address in Incognito", () => {
    mockPersistentState = stateWithMode(AccountMode.Anon)

    const { result } = renderHook(() => useLightningAddressGated())

    expect(result.current).toBe(true)
  })

  it("leaves the address available in Enhanced", () => {
    mockPersistentState = stateWithMode(AccountMode.Enhanced)

    const { result } = renderHook(() => useLightningAddressGated())

    expect(result.current).toBe(false)
  })

  /** An account that has not chosen a mode is not Incognito, so nothing is withheld:
   *  only the stored Incognito choice withdraws the address. */
  it("leaves the address available before a mode has been chosen", () => {
    mockPersistentState = { ...baseState, activeAccountId: "self-custodial-1" }

    const { result } = renderHook(() => useLightningAddressGated())

    expect(result.current).toBe(false)
  })

  /** A custodial session has no self-custodial mode to read, and its address is the
   *  server's username, which this gate has no business withdrawing. */
  it("leaves the address available when no self-custodial account is active", () => {
    const { result } = renderHook(() => useLightningAddressGated())

    expect(result.current).toBe(false)
  })
})
