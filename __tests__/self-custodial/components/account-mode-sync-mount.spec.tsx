import React from "react"
import { render } from "@testing-library/react-native"

// React 19 react-test-renderer calls window.dispatchEvent for error
// reporting which doesn't exist in React Native jest environment.
if (typeof window !== "undefined" && !window.dispatchEvent) {
  window.dispatchEvent = jest.fn()
}

import { AccountModeSyncMount } from "@app/self-custodial/components/account-mode-sync-mount"

const mockAccountModeSync = jest.fn()
jest.mock("@app/self-custodial/hooks/use-account-mode-sync", () => ({
  useAccountModeSync: () => mockAccountModeSync(),
}))

describe("AccountModeSyncMount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("mounts the mode sync hook exactly once per render", () => {
    render(<AccountModeSyncMount />)

    expect(mockAccountModeSync).toHaveBeenCalledTimes(1)
  })

  it("renders null so it contributes no UI to the tree", () => {
    const { toJSON } = render(<AccountModeSyncMount />)

    expect(toJSON()).toBeNull()
  })
})
