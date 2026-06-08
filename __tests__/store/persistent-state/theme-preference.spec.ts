import { PersistentState } from "@app/store/persistent-state/state-migrations"
import {
  getThemePreference,
  withThemePreference,
} from "@app/store/persistent-state/theme-preference"
import { DefaultAccountId } from "@app/types/wallet"

const baseState: PersistentState = {
  schemaVersion: 13,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("getThemePreference", () => {
  it("returns 'system' as the ultimate default", () => {
    expect(getThemePreference(baseState)).toBe("system")
  })

  it("returns the per-account map value when set for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
      themeByAccountId: {
        "self-custodial-1": "dark",
        "self-custodial-2": "light",
      },
    }

    expect(getThemePreference(state)).toBe("dark")
  })

  it("isolates theme per active account", () => {
    const map = {
      "self-custodial-1": "dark",
      "self-custodial-2": "light",
    } as const

    expect(
      getThemePreference({
        ...baseState,
        activeAccountId: "self-custodial-1",
        themeByAccountId: map,
      }),
    ).toBe("dark")

    expect(
      getThemePreference({
        ...baseState,
        activeAccountId: "self-custodial-2",
        themeByAccountId: map,
      }),
    ).toBe("light")
  })

  it("does not leak the custodial theme into a self-custodial account", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
      themeByAccountId: { [DefaultAccountId.Custodial]: "dark" },
    }

    expect(getThemePreference(state)).toBe("system")
  })

  it("does not leak a self-custodial theme into the custodial slot", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: DefaultAccountId.Custodial,
      themeByAccountId: { "self-custodial-1": "dark" },
    }

    expect(getThemePreference(state)).toBe("system")
  })

  it("falls back to 'system' when map is absent for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-new",
      themeByAccountId: { "self-custodial-other": "dark" },
    }

    expect(getThemePreference(state)).toBe("system")
  })

  it("returns the custodial-slot value when active is custodial", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: DefaultAccountId.Custodial,
      themeByAccountId: { [DefaultAccountId.Custodial]: "light" },
    }

    expect(getThemePreference(state)).toBe("light")
  })

  it("falls back to the custodial slot when there is no active account", () => {
    const state: PersistentState = {
      ...baseState,
      themeByAccountId: { [DefaultAccountId.Custodial]: "dark" },
    }

    expect(getThemePreference(state)).toBe("dark")
  })
})

describe("withThemePreference", () => {
  it("writes the theme under the active self-custodial id", () => {
    const state: PersistentState = { ...baseState, activeAccountId: "self-custodial-1" }

    const next = withThemePreference(state, "dark")

    expect(next.themeByAccountId).toEqual({
      "self-custodial-1": "dark",
    })
  })

  it("writes under the custodial slot when active is custodial", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: DefaultAccountId.Custodial,
    }

    const next = withThemePreference(state, "light")

    expect(next.themeByAccountId).toEqual({
      [DefaultAccountId.Custodial]: "light",
    })
  })

  it("writes under the custodial slot when there is no active account", () => {
    const next = withThemePreference(baseState, "dark")

    expect(next.themeByAccountId).toEqual({
      [DefaultAccountId.Custodial]: "dark",
    })
  })

  it("preserves entries for other accounts when writing", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-2",
      themeByAccountId: { "self-custodial-1": "dark" },
    }

    const next = withThemePreference(state, "light")

    expect(next.themeByAccountId).toEqual({
      "self-custodial-1": "dark",
      "self-custodial-2": "light",
    })
  })

  it("overwrites the existing value for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
      themeByAccountId: { "self-custodial-1": "dark" },
    }

    const next = withThemePreference(state, "light")

    expect(next.themeByAccountId).toEqual({
      "self-custodial-1": "light",
    })
  })

  it("does not overwrite the custodial slot when writing for a self-custodial account", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
      themeByAccountId: { [DefaultAccountId.Custodial]: "dark" },
    }

    const next = withThemePreference(state, "light")

    expect(next.themeByAccountId).toEqual({
      [DefaultAccountId.Custodial]: "dark",
      "self-custodial-1": "light",
    })
  })
})
