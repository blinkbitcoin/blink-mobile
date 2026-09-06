import { renderHook } from "@testing-library/react-native"
// See the measurement specs — the mocha types in tsconfig shadow Jest's `it`.
import { it } from "@jest/globals"

import { useTelemetryGate } from "@app/self-custodial/hooks/use-telemetry-gate"
import {
  getTelemetryMode,
  resetTelemetryGateForTesting,
  TelemetryMode,
} from "@app/self-custodial/measurement/gate"
import { AccountMode } from "@app/types/account"
import { AccountType } from "@app/types/wallet"

let mockActiveAccount: { type: AccountType } | undefined = undefined
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount }),
}))

let mockAccountMode: AccountMode | null = null
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ accountMode: mockAccountMode }),
}))

type Case = { label: string; mode: TelemetryMode }

const SELF_CUSTODIAL_CASES: Case[] = [
  { label: "enhanced", mode: TelemetryMode.Enhanced },
  { label: "anon", mode: TelemetryMode.Incognito },
]

describe("useTelemetryGate", () => {
  beforeEach(() => {
    resetTelemetryGateForTesting()
    mockActiveAccount = undefined
    mockAccountMode = null
  })

  it("resolves custodial for a custodial account", () => {
    mockActiveAccount = { type: AccountType.Custodial }

    renderHook(() => useTelemetryGate())

    expect(getTelemetryMode()).toBe(TelemetryMode.Custodial)
  })

  it.each(SELF_CUSTODIAL_CASES)(
    "resolves $label for a self-custodial account in that mode",
    ({ label, mode }) => {
      mockActiveAccount = { type: AccountType.SelfCustodial }
      mockAccountMode = label === "enhanced" ? AccountMode.Enhanced : AccountMode.Anon

      renderHook(() => useTelemetryGate())

      expect(getTelemetryMode()).toBe(mode)
    },
  )

  it("leaves a self-custodial account with no chosen mode unresolved", () => {
    // The settings row reads an unset mode as Enhanced so it has something to display.
    // The gate must not: §5.7 wants a positive resolution, and "never asked" is not one.
    mockActiveAccount = { type: AccountType.SelfCustodial }
    mockAccountMode = null

    renderHook(() => useTelemetryGate())

    expect(getTelemetryMode()).toBe(TelemetryMode.Unresolved)
  })

  it("leaves the gate unresolved when no account is active", () => {
    mockActiveAccount = undefined

    renderHook(() => useTelemetryGate())

    expect(getTelemetryMode()).toBe(TelemetryMode.Unresolved)
  })

  it("follows a mode change on the active account", () => {
    mockActiveAccount = { type: AccountType.SelfCustodial }
    mockAccountMode = AccountMode.Enhanced
    const { rerender } = renderHook(() => useTelemetryGate())
    expect(getTelemetryMode()).toBe(TelemetryMode.Enhanced)

    mockAccountMode = AccountMode.Anon
    rerender({})

    expect(getTelemetryMode()).toBe(TelemetryMode.Incognito)
  })

  it("follows a switch from an Enhanced account to a custodial one", () => {
    mockActiveAccount = { type: AccountType.SelfCustodial }
    mockAccountMode = AccountMode.Enhanced
    const { rerender } = renderHook(() => useTelemetryGate())
    expect(getTelemetryMode()).toBe(TelemetryMode.Enhanced)

    mockActiveAccount = { type: AccountType.Custodial }
    rerender({})

    expect(getTelemetryMode()).toBe(TelemetryMode.Custodial)
  })

  it("closes the gate when an Enhanced account is switched away from entirely", () => {
    mockActiveAccount = { type: AccountType.SelfCustodial }
    mockAccountMode = AccountMode.Enhanced
    const { rerender } = renderHook(() => useTelemetryGate())
    expect(getTelemetryMode()).toBe(TelemetryMode.Enhanced)

    mockActiveAccount = undefined
    mockAccountMode = null
    rerender({})

    expect(getTelemetryMode()).toBe(TelemetryMode.Unresolved)
  })
})
