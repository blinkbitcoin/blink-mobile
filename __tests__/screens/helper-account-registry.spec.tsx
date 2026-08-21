import React from "react"

import { render, screen } from "@testing-library/react-native"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { AccountType, DefaultAccountId } from "@app/types/wallet"

import { Text } from "react-native"

import { ContextForScreen } from "./helper"

// The shared wrapper hands screens a settled registry composed by the same hook
// the provider uses (`useComposedAccountRegistry`). These cases pin the two
// things a screen spec relies on: what the default stub contains, and that
// seeding through `accountRegistry` actually reaches `useAccountRegistry`. If
// the provider's composition changes shape, they fail here rather than showing
// up as an unexplained assertion failure in one of the ~110 screen specs.
const RegistryProbe = () => {
  const { accounts, activeAccount, loading } = useAccountRegistry()
  return (
    <>
      <Text testID="loading">{String(loading)}</Text>
      <Text testID="active">{activeAccount?.id ?? "none"}</Text>
      {accounts.map((account) => (
        <Text key={account.id} testID={`account-${account.type}`}>
          {`${account.id}|${account.label}|${account.selected}`}
        </Text>
      ))}
    </>
  )
}

describe("ContextForScreen account registry", () => {
  it("defaults to a settled custodial-only registry", () => {
    render(
      <ContextForScreen>
        <RegistryProbe />
      </ContextForScreen>,
    )

    // Settled: no screen spec has to flush effects to trust `accounts`.
    expect(screen.getByTestId("loading").props.children).toBe("false")
    expect(screen.getByTestId("active").props.children).toBe(DefaultAccountId.Custodial)
    expect(screen.getByTestId(`account-${AccountType.Custodial}`)).toBeTruthy()
    expect(screen.queryByTestId(`account-${AccountType.SelfCustodial}`)).toBeNull()
  })

  it("exposes seeded self-custodial entries to the screen under test", () => {
    render(
      <ContextForScreen
        accountRegistry={{
          entries: [{ id: "self-1", lightningAddress: "someone@blink.sv" }],
        }}
      >
        <RegistryProbe />
      </ContextForScreen>,
    )

    expect(
      screen.getByTestId(`account-${AccountType.SelfCustodial}`).props.children,
    ).toBe("self-1|someone@blink.sv|false")
    // The custodial account stays selected: the wrapper's persistent state has
    // no `activeAccountId`, so selection falls through to the first account.
    expect(screen.getByTestId("active").props.children).toBe(DefaultAccountId.Custodial)
  })

  it("keeps the custodial account while the wrapper is authed, whatever the seed says", () => {
    render(
      <ContextForScreen
        accountRegistry={{
          hasStoredCustodialProfile: false,
          entries: [{ id: "self-1", lightningAddress: null }],
        }}
      >
        <RegistryProbe />
      </ContextForScreen>,
    )

    // `IsAuthedContextProvider value={true}` in the wrapper still forces the
    // custodial descriptor in — the flag alone cannot remove it. This pins that
    // relationship so a spec seeding `false` is not misled into thinking it can.
    expect(screen.getByTestId(`account-${AccountType.Custodial}`)).toBeTruthy()
  })
})
