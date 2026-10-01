import React from "react"

import { loadJson, saveJson } from "@app/utils/storage"

import { type GaloyInstance } from "./galoy-instances"

/**
 * A developer-only switch that makes the app behave as though a Blink service were down,
 * so the self-custodial paths that must survive an outage can be exercised without
 * tearing down a backend.
 *
 * It rewrites the addresses the client dials rather than faking failures further up. A
 * stubbed error would only prove that the handler under test runs; pointing the socket
 * somewhere that cannot answer exercises the real transport, its retry budget and every
 * consumer in between, which is where the interesting behaviour lives.
 *
 * Hard-gated to `__DEV__`: a release build reads {@link NO_OUTAGE} whatever is stored and
 * refuses to write, so nothing here can reach a user even if the key survives in storage.
 */

export const OutageMode = {
  Off: "off",
  /** The socket is refused immediately, the way a stopped local service answers. */
  Refused: "refused",
  /** Packets are black-holed, so requests hang until their own timeout. */
  Unreachable: "unreachable",
} as const

export type OutageMode = (typeof OutageMode)[keyof typeof OutageMode]

export const OUTAGE_MODES: readonly OutageMode[] = [
  OutageMode.Off,
  OutageMode.Refused,
  OutageMode.Unreachable,
]

export type SimulatedOutage = {
  /** The GraphQL API — `graphqlUri` and `graphqlWsUri` on the active instance. */
  graphql: OutageMode
  /** The LNURL server, which is a separate deployment from the GraphQL API. */
  lnurlServer: OutageMode
}

const NO_OUTAGE: SimulatedOutage = Object.freeze({
  graphql: OutageMode.Off,
  lnurlServer: OutageMode.Off,
})

/** Port 1 on the loopback interface: nothing listens, so the connection is refused at
 *  once. On a device this is the device itself, not the development machine. */
const REFUSED_HOST = "127.0.0.1:1"

/** RFC 5737 TEST-NET-1, reserved for documentation and routed nowhere. */
const UNREACHABLE_HOST = "192.0.2.1"

const SIMULATED_OUTAGE_KEY = "developerSimulatedOutage"

const isSimulationAvailable = (): boolean => __DEV__

const isOutageMode = (value: unknown): value is OutageMode =>
  OUTAGE_MODES.includes(value as OutageMode)

const parseStored = (raw: unknown): SimulatedOutage => {
  if (!raw || typeof raw !== "object") return NO_OUTAGE
  const { graphql, lnurlServer } = raw as Partial<Record<keyof SimulatedOutage, unknown>>
  if (!isOutageMode(graphql) || !isOutageMode(lnurlServer)) return NO_OUTAGE
  if (graphql === OutageMode.Off && lnurlServer === OutageMode.Off) return NO_OUTAGE
  return { graphql, lnurlServer }
}

let snapshot: SimulatedOutage = NO_OUTAGE
const listeners = new Set<() => void>()

const notify = (): void => listeners.forEach((listener) => listener())

export const subscribeToSimulatedOutage = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Referentially stable while nothing changes, which is what `useSyncExternalStore`
 *  needs to avoid re-rendering on every read. */
const getSnapshot = (): SimulatedOutage =>
  isSimulationAvailable() ? snapshot : NO_OUTAGE

/**
 * Reads the stored switch into memory. Called once at startup, before the Apollo client
 * is built, so a simulated outage survives the reload a developer does to test a cold
 * start — the case where nothing has been cached yet, which is the one that matters.
 */
export const hydrateSimulatedOutage = async (): Promise<void> => {
  if (!isSimulationAvailable()) return
  const stored = parseStored(await loadJson(SIMULATED_OUTAGE_KEY))
  if (stored === snapshot) return
  snapshot = stored
  notify()
}

export const setSimulatedOutage = (patch: Partial<SimulatedOutage>): void => {
  if (!isSimulationAvailable()) return
  const next: SimulatedOutage = { ...snapshot, ...patch }
  if (next.graphql === snapshot.graphql && next.lnurlServer === snapshot.lnurlServer) {
    return
  }
  snapshot =
    next.graphql === OutageMode.Off && next.lnurlServer === OutageMode.Off
      ? NO_OUTAGE
      : next
  notify()
  // Best effort: losing the write costs the next launch its simulation, nothing more.
  saveJson(SIMULATED_OUTAGE_KEY, snapshot).catch(() => {})
}

/** Synchronous read for the non-React callers — the SDK config builder and the LNURL
 *  server URL, neither of which sits in a component. */
export const getSimulatedOutage = (): SimulatedOutage => getSnapshot()

export const useSimulatedOutage = (): SimulatedOutage =>
  React.useSyncExternalStore(subscribeToSimulatedOutage, getSnapshot, getSnapshot)

/** Test seam: drops the in-memory switch without touching storage. */
export const resetSimulatedOutageForTests = (): void => {
  snapshot = NO_OUTAGE
  listeners.clear()
}

/** The host to dial instead of the real one, or null when the service is not simulated
 *  as down. */
export const simulatedOutageHost = (mode: OutageMode): string | null => {
  if (mode === OutageMode.Refused) return REFUSED_HOST
  if (mode === OutageMode.Unreachable) return UNREACHABLE_HOST
  return null
}

/**
 * Points the instance's GraphQL addresses at a host that cannot answer, leaving every
 * other field alone: the POS, KYC and fiat URLs are opened in a browser rather than
 * dialled by the client, and the LNURL server has its own switch.
 *
 * `http`/`ws` rather than `https`/`wss` so the failure is a transport error rather than
 * a TLS handshake against a host with no certificate, which some stacks report
 * differently.
 */
export const withSimulatedGraphqlOutage = (
  instance: GaloyInstance,
  mode: OutageMode,
): GaloyInstance => {
  const host = simulatedOutageHost(mode)
  if (!host) return instance
  return {
    ...instance,
    graphqlUri: `http://${host}/graphql`,
    graphqlWsUri: `ws://${host}/graphqlws`,
  }
}
