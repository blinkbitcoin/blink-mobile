import { describe, expect, it, beforeEach, jest } from "@jest/globals"

import {
  getSimulatedOutage,
  hydrateSimulatedOutage,
  OutageMode,
  resetSimulatedOutageForTests,
  setSimulatedOutage,
  simulatedOutageHost,
  subscribeToSimulatedOutage,
  withSimulatedGraphqlOutage,
} from "@app/config/simulated-outage"
import { loadJson } from "@app/utils/storage"

import { GALOY_INSTANCES } from "@app/config/galoy-instances"

jest.mock("@app/utils/storage", () => ({
  loadJson: jest.fn(async () => null),
  saveJson: jest.fn(async () => undefined),
}))

const mockedLoadJson = loadJson as jest.MockedFunction<typeof loadJson>

const mainInstance = GALOY_INSTANCES.find((instance) => instance.id === "Main")
if (!mainInstance) throw new Error("Main instance missing from GALOY_INSTANCES")

describe("simulatedOutageHost", () => {
  it("maps Off to no host, so callers keep the real address", () => {
    expect(simulatedOutageHost(OutageMode.Off)).toBeNull()
  })

  it("maps Refused to loopback, where nothing listens", () => {
    expect(simulatedOutageHost(OutageMode.Refused)).toBe("127.0.0.1:1")
  })

  it("maps Unreachable to a black-holed documentation address", () => {
    expect(simulatedOutageHost(OutageMode.Unreachable)).toBe("192.0.2.1")
  })
})

describe("withSimulatedGraphqlOutage", () => {
  it("returns the instance untouched when nothing is simulated", () => {
    expect(withSimulatedGraphqlOutage(mainInstance, OutageMode.Off)).toBe(mainInstance)
  })

  it("rewrites only the two GraphQL addresses", () => {
    const rewritten = withSimulatedGraphqlOutage(mainInstance, OutageMode.Refused)

    expect(rewritten.graphqlUri).toBe("http://127.0.0.1:1/graphql")
    expect(rewritten.graphqlWsUri).toBe("ws://127.0.0.1:1/graphqlws")
    // Everything the client does not dial keeps pointing at the real deployment.
    expect(rewritten.posUrl).toBe(mainInstance.posUrl)
    expect(rewritten.kycUrl).toBe(mainInstance.kycUrl)
    expect(rewritten.fiatUrl).toBe(mainInstance.fiatUrl)
    expect(rewritten.authUrl).toBe(mainInstance.authUrl)
    expect(rewritten.lnAddressHostname).toBe(mainInstance.lnAddressHostname)
  })
})

describe("the simulated outage store", () => {
  beforeEach(() => {
    resetSimulatedOutageForTests()
    mockedLoadJson.mockReset()
    mockedLoadJson.mockResolvedValue(null)
  })

  it("starts with no outage", () => {
    expect(getSimulatedOutage()).toEqual({
      graphql: OutageMode.Off,
      lnurlServer: OutageMode.Off,
    })
  })

  it("records a per-service switch without disturbing the other", () => {
    setSimulatedOutage({ graphql: OutageMode.Unreachable })

    expect(getSimulatedOutage()).toEqual({
      graphql: OutageMode.Unreachable,
      lnurlServer: OutageMode.Off,
    })
  })

  it("hydrates a stored switch", async () => {
    mockedLoadJson.mockResolvedValue({
      graphql: OutageMode.Off,
      lnurlServer: OutageMode.Refused,
    })

    await hydrateSimulatedOutage()

    expect(getSimulatedOutage()).toEqual({
      graphql: OutageMode.Off,
      lnurlServer: OutageMode.Refused,
    })
  })

  it("ignores a stored blob whose modes it does not recognise", async () => {
    mockedLoadJson.mockResolvedValue({ graphql: "on-fire", lnurlServer: "off" })

    await hydrateSimulatedOutage()

    expect(getSimulatedOutage()).toEqual({
      graphql: OutageMode.Off,
      lnurlServer: OutageMode.Off,
    })
  })

  it("keeps the snapshot referentially stable while nothing changes", () => {
    const before = getSimulatedOutage()
    setSimulatedOutage({ graphql: OutageMode.Off })

    // A `useSyncExternalStore` consumer re-renders on a new reference, so an
    // idempotent write must not produce one.
    expect(getSimulatedOutage()).toBe(before)
  })

  it("returns to the shared no-outage snapshot when every service is switched back", () => {
    const before = getSimulatedOutage()
    setSimulatedOutage({ graphql: OutageMode.Refused })
    setSimulatedOutage({ graphql: OutageMode.Off })

    expect(getSimulatedOutage()).toBe(before)
  })

  it("notifies subscribers on a change and not on a no-op", () => {
    const listener = jest.fn()
    const unsubscribe = subscribeToSimulatedOutage(listener)

    setSimulatedOutage({ lnurlServer: OutageMode.Refused })
    expect(listener).toHaveBeenCalledTimes(1)

    setSimulatedOutage({ lnurlServer: OutageMode.Refused })
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    setSimulatedOutage({ lnurlServer: OutageMode.Off })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("notifies subscribers when hydration changes the switch", async () => {
    const listener = jest.fn()
    const unsubscribe = subscribeToSimulatedOutage(listener)
    mockedLoadJson.mockResolvedValue({
      graphql: OutageMode.Unreachable,
      lnurlServer: OutageMode.Off,
    })

    await hydrateSimulatedOutage()

    expect(listener).toHaveBeenCalledTimes(1)
    expect(getSimulatedOutage().graphql).toBe(OutageMode.Unreachable)
    unsubscribe()
  })

  it("stays quiet when hydration finds nothing stored", async () => {
    const listener = jest.fn()
    const unsubscribe = subscribeToSimulatedOutage(listener)

    await hydrateSimulatedOutage()

    expect(listener).not.toHaveBeenCalled()
    expect(getSimulatedOutage().graphql).toBe(OutageMode.Off)
    unsubscribe()
  })
})
