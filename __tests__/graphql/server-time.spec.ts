import { ApolloLink, execute, FetchResult, gql, Observable } from "@apollo/client"

import {
  createServerTimeLink,
  isDeviceClockSkewed,
  resetObservedClockSkew,
} from "@app/graphql/server-time"

const DEVICE_NOW = Date.parse("2026-01-01T00:00:00.000Z")
const MINUTE = 60_000

/** An HTTP-style date string for a server clock `offsetMs` from the (faked) device clock. */
const serverDate = (offsetMs: number): string =>
  new Date(DEVICE_NOW + offsetMs).toUTCString()

type ResponseContext = {
  response?: { headers?: { get?: (key: string) => string | undefined } }
}

/** Runs one operation through the afterware with the given response context on it. */
const observe = (context: ResponseContext): Promise<FetchResult | undefined> => {
  const terminating = new ApolloLink((operation) => {
    operation.setContext(context)
    return Observable.of({ data: { ok: true } })
  })
  return new Promise((resolve) => {
    execute(ApolloLink.from([createServerTimeLink(), terminating]), {
      query: gql`
        query Ping {
          __typename
        }
      `,
    }).subscribe((result) => resolve(result))
  })
}

const withDateHeader = (date: string | undefined): ResponseContext => ({
  response: { headers: { get: (key) => (key === "date" ? date : undefined) } },
})

describe("server-time", () => {
  beforeEach(() => {
    resetObservedClockSkew()
    jest.useFakeTimers()
    jest.setSystemTime(DEVICE_NOW)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe("isDeviceClockSkewed", () => {
    it("is false before any server time is observed", () => {
      expect(isDeviceClockSkewed()).toBe(false)
    })

    it("is false within the backend's freshness window", async () => {
      await observe(withDateHeader(serverDate(9 * MINUTE)))
      expect(isDeviceClockSkewed()).toBe(false)
    })

    it("is false at exactly the ten-minute window", async () => {
      await observe(withDateHeader(serverDate(10 * MINUTE)))
      expect(isDeviceClockSkewed()).toBe(false)
    })

    it("is true when the device clock runs far behind the server", async () => {
      await observe(withDateHeader(serverDate(11 * MINUTE)))
      expect(isDeviceClockSkewed()).toBe(true)
    })

    it("is true when the device clock runs far ahead of the server", async () => {
      await observe(withDateHeader(serverDate(-11 * MINUTE)))
      expect(isDeviceClockSkewed()).toBe(true)
    })

    it("ignores an unparseable Date header", async () => {
      await observe(withDateHeader("not a real date"))
      expect(isDeviceClockSkewed()).toBe(false)
    })
  })

  describe("createServerTimeLink", () => {
    it("does nothing when the response has no Date header", async () => {
      await observe(withDateHeader(undefined))
      expect(isDeviceClockSkewed()).toBe(false)
    })

    it("does nothing when the headers object exposes no get", async () => {
      await observe({ response: { headers: {} } })
      expect(isDeviceClockSkewed()).toBe(false)
    })

    it("does nothing when the response carries no headers", async () => {
      await observe({ response: {} })
      expect(isDeviceClockSkewed()).toBe(false)
    })

    it("does nothing when there is no response on the context", async () => {
      await observe({})
      expect(isDeviceClockSkewed()).toBe(false)
    })

    it("passes the result through unchanged", async () => {
      const result = await observe(withDateHeader(serverDate(0)))
      expect(result).toEqual({ data: { ok: true } })
    })
  })
})
