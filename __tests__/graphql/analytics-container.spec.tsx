import React from "react"
import { render } from "@testing-library/react-native"

import { AnalyticsContainer } from "@app/graphql/analytics"

const mockSetCustodialIdentity = jest.fn()
const mockSetSharedUserProperties = jest.fn()
const mockSetUserId = jest.fn()

jest.mock("@app/self-custodial/analytics-identity", () => ({
  setCustodialIdentity: (...args: unknown[]) => mockSetCustodialIdentity(...args),
  setSharedUserProperties: (...args: unknown[]) => mockSetSharedUserProperties(...args),
}))

jest.mock("@react-native-firebase/analytics", () => () => ({
  setUserId: (...args: unknown[]) => mockSetUserId(...args),
  setUserProperty: jest.fn(),
  setUserProperties: jest.fn(),
}))

let mockMe: { id: string; username: string | null } | null = null

jest.mock("@app/graphql/generated", () => ({
  useAnalyticsQuery: () => ({
    data: { me: mockMe, globals: { network: "mainnet" } },
  }),
}))

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({ appConfig: { galoyInstance: { name: "Main" } } }),
}))

jest.mock("@app/graphql/is-authed-context", () => ({ useIsAuthed: () => true }))
jest.mock("@app/graphql/level-context", () => ({
  useLevel: () => ({ currentLevel: "TWO" }),
}))

describe("AnalyticsContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMe = { id: "me-1", username: "alice" }
  })

  it("hands the custodial identity to its owner instead of attaching it itself", () => {
    render(<AnalyticsContainer />)

    expect(mockSetCustodialIdentity).toHaveBeenLastCalledWith({
      userId: "me-1",
      hasUsername: true,
      accountLevel: "TWO",
    })
    /** Attaching `me.id` directly would bypass the side check and the instance reset. */
    expect(mockSetUserId).not.toHaveBeenCalled()
  })

  it("passes the app's own properties as shared, non-identifying ones", () => {
    render(<AnalyticsContainer />)

    expect(mockSetSharedUserProperties).toHaveBeenCalledWith({ network: "mainnet" })
    expect(mockSetSharedUserProperties).toHaveBeenCalledWith({ galoyInstance: "Main" })
  })

  it("reports a missing username as such", () => {
    mockMe = { id: "me-1", username: null }

    render(<AnalyticsContainer />)

    expect(mockSetCustodialIdentity).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasUsername: false }),
    )
  })
})
