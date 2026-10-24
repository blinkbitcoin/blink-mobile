import React from "react"

import { loadJson, saveJson } from "@app/utils/storage"

/**
 * Developer-only overrides for the two self-custodial rollout flags.
 *
 * Those flags arrive from Firebase Remote Config and ship defaulting to `false`, and
 * `fetchAndActivate` needs Google Play Services — so on an emulator without them the
 * fetch fails, every flag silently falls back to its default, and the self-custodial
 * path is simply absent: Get Started routes straight to custodial login. Editing the
 * shipped default to test is a change you then have to remember not to commit.
 *
 * Three states rather than a boolean, because `docs/self-custodial-rollout.md` asks for
 * the flag to be flipped *both* ways: forcing a flag off while Remote Config says on is
 * the rollback scenario, and is not reachable with an on/off toggle that only adds.
 *
 * Hard-gated to `__DEV__`, like {@link module:app/config/simulated-outage}: a release
 * build reads {@link NO_OVERRIDES} whatever is stored and refuses to write.
 */

export const FlagOverride = {
  /** Honour whatever Remote Config resolved to. */
  Default: "default",
  On: "on",
  Off: "off",
} as const

export type FlagOverride = (typeof FlagOverride)[keyof typeof FlagOverride]

export const FLAG_OVERRIDES: readonly FlagOverride[] = [
  FlagOverride.Default,
  FlagOverride.On,
  FlagOverride.Off,
]

export type FeatureFlagOverrides = {
  nonCustodialEnabled: FlagOverride
  stableBalanceEnabled: FlagOverride
}

const NO_OVERRIDES: FeatureFlagOverrides = Object.freeze({
  nonCustodialEnabled: FlagOverride.Default,
  stableBalanceEnabled: FlagOverride.Default,
})

const OVERRIDES_KEY = "developerFeatureFlagOverrides"

const isSimulationAvailable = (): boolean => __DEV__

const isFlagOverride = (value: unknown): value is FlagOverride =>
  FLAG_OVERRIDES.includes(value as FlagOverride)

const isDefaulted = (overrides: FeatureFlagOverrides): boolean =>
  overrides.nonCustodialEnabled === FlagOverride.Default &&
  overrides.stableBalanceEnabled === FlagOverride.Default

const parseStored = (raw: unknown): FeatureFlagOverrides => {
  if (!raw || typeof raw !== "object") return NO_OVERRIDES
  const { nonCustodialEnabled, stableBalanceEnabled } = raw as Partial<
    Record<keyof FeatureFlagOverrides, unknown>
  >
  if (!isFlagOverride(nonCustodialEnabled) || !isFlagOverride(stableBalanceEnabled)) {
    return NO_OVERRIDES
  }
  const parsed = { nonCustodialEnabled, stableBalanceEnabled }
  return isDefaulted(parsed) ? NO_OVERRIDES : parsed
}

let snapshot: FeatureFlagOverrides = NO_OVERRIDES
const listeners = new Set<() => void>()

export const subscribeToFeatureFlagOverrides = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Referentially stable while nothing changes, which is what `useSyncExternalStore`
 *  needs to avoid re-rendering on every read. */
const getSnapshot = (): FeatureFlagOverrides =>
  isSimulationAvailable() ? snapshot : NO_OVERRIDES

/**
 * Reads the stored overrides into memory. Called once at startup, before the flag
 * context first renders, so an override survives the reload that applies it.
 */
export const hydrateFeatureFlagOverrides = async (): Promise<void> => {
  if (!isSimulationAvailable()) return
  const stored = parseStored(await loadJson(OVERRIDES_KEY))
  if (stored === snapshot) return
  snapshot = stored
  listeners.forEach((listener) => listener())
}

export const setFeatureFlagOverride = (patch: Partial<FeatureFlagOverrides>): void => {
  if (!isSimulationAvailable()) return
  const next: FeatureFlagOverrides = { ...snapshot, ...patch }
  if (
    next.nonCustodialEnabled === snapshot.nonCustodialEnabled &&
    next.stableBalanceEnabled === snapshot.stableBalanceEnabled
  ) {
    return
  }
  snapshot = isDefaulted(next) ? NO_OVERRIDES : next
  listeners.forEach((listener) => listener())
  // Best effort: losing the write costs the next launch its override, nothing more.
  saveJson(OVERRIDES_KEY, snapshot).catch(() => {})
}

export const getFeatureFlagOverrides = (): FeatureFlagOverrides => getSnapshot()

export const useFeatureFlagOverrides = (): FeatureFlagOverrides =>
  React.useSyncExternalStore(subscribeToFeatureFlagOverrides, getSnapshot, getSnapshot)

/** Test seam: drops the in-memory overrides without touching storage. */
export const resetFeatureFlagOverridesForTests = (): void => {
  snapshot = NO_OVERRIDES
  listeners.clear()
}

/** Applies one override to the value Remote Config resolved to. */
export const applyFlagOverride = (
  remoteValue: boolean,
  override: FlagOverride,
): boolean => {
  if (override === FlagOverride.On) return true
  if (override === FlagOverride.Off) return false
  return remoteValue
}

export type SelfCustodialFlags = {
  nonCustodialEnabled: boolean
  stableBalanceEnabled: boolean
}

/**
 * The two self-custodial rollout flags as the app should read them: each override
 * applied, then the cascade — Stable Balance cannot be on while self-custodial is off,
 * since it is a feature *of* a self-custodial account.
 *
 * Order matters. Overriding `nonCustodialEnabled` off takes Stable Balance with it,
 * which is what the rollback scenario in `docs/self-custodial-rollout.md` expects; the
 * cascade applied first would let a forced Stable Balance survive it.
 *
 * Exported and pure so the flag context and its spec share one derivation. It lives
 * here rather than in `feature-flags-context.tsx` because importing that pulls in
 * Firebase Remote Config, which a unit test should not have to stand up.
 */
export const deriveSelfCustodialFlags = (
  remote: SelfCustodialFlags,
  overrides: FeatureFlagOverrides,
): SelfCustodialFlags => {
  const nonCustodialEnabled = applyFlagOverride(
    remote.nonCustodialEnabled,
    overrides.nonCustodialEnabled,
  )
  const stableBalanceEnabled = applyFlagOverride(
    remote.stableBalanceEnabled,
    overrides.stableBalanceEnabled,
  )
  return {
    nonCustodialEnabled,
    stableBalanceEnabled: nonCustodialEnabled && stableBalanceEnabled,
  }
}

/** What `deriveSelfCustodialFlags` reads when nothing is overridden. */
export const NO_FLAG_OVERRIDES: FeatureFlagOverrides = NO_OVERRIDES
