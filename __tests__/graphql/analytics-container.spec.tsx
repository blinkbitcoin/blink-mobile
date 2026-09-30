import React from "react"

import { render } from "@testing-library/react-native"

import { AnalyticsContainer } from "@app/graphql/analytics"

const mockSetCustodialAnalyticsIdentity = jest.fn()

jest.mock("@app/telemetry", () => ({
  setCustodialAnalyticsIdentity: (...args: unknown[]) =>
    mockSetCustodialAnalyticsIdentity(...args),
}))

let mockMe: { id?: string; username?: string } | undefined = {
  id: "ledger-account-id",
  username: "satoshi",
}

jest.mock("@app/graphql/generated", () => ({
  useAnalyticsQuery: () => ({
    data: { me: mockMe, globals: { network: "mainnet" } },
  }),
}))

jest.mock("@app/graphql/is-authed-context", () => ({ useIsAuthed: () => true }))
jest.mock("@app/graphql/level-context", () => ({
  useLevel: () => ({ currentLevel: "One" }),
}))
jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({ appConfig: { galoyInstance: { name: "Main" } } }),
}))

describe("AnalyticsContainer", () => {
  beforeEach(() => {
    mockMe = { id: "ledger-account-id", username: "satoshi" }
    jest.clearAllMocks()
  })

  it("sets custodial identity through the boundary, not the platform SDK", () => {
    // The ledger account ID used to reach `analytics().setUserId` directly and was never
    // cleared, so Firebase merged it into every later event — including one emitted after
    // the user switched to a self-custodial account. Routing it here is what makes the mode
    // gate able to clear it.
    render(<AnalyticsContainer />)

    expect(mockSetCustodialAnalyticsIdentity).toHaveBeenCalledWith({
      userId: "ledger-account-id",
    })
  })

  it("routes every user property through the same call", () => {
    render(<AnalyticsContainer />)

    const properties = mockSetCustodialAnalyticsIdentity.mock.calls
      .map(([arg]) => (arg as { properties?: Record<string, string> }).properties)
      .filter(Boolean)

    expect(Object.assign({}, ...properties)).toEqual({
      hasUsername: "true",
      network: "mainnet",
      accountLevel: "One",
      galoyInstance: "Main",
    })
  })

  it("says so when the account has no username, rather than leaving the property unset", () => {
    // The property is what the board splits on, so "no username" has to be a value.
    mockMe = { id: "ledger-account-id" }

    render(<AnalyticsContainer />)

    expect(mockSetCustodialAnalyticsIdentity).toHaveBeenCalledWith({
      properties: { hasUsername: "false" },
    })
  })

  it("sets no user id at all when the query has not answered yet", () => {
    mockMe = undefined

    render(<AnalyticsContainer />)

    expect(mockSetCustodialAnalyticsIdentity).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: expect.anything() }),
    )
  })
})
