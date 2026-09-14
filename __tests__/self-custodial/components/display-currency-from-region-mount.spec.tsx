import React from "react"
import { render } from "@testing-library/react-native"

// React 19 react-test-renderer calls window.dispatchEvent for error
// reporting which doesn't exist in React Native jest environment.
if (typeof window !== "undefined" && !window.dispatchEvent) {
  window.dispatchEvent = jest.fn()
}

import { DisplayCurrencyFromRegionMount } from "@app/self-custodial/components/display-currency-from-region-mount"

const mockDisplayCurrencyFromRegion = jest.fn()
jest.mock("@app/self-custodial/hooks/use-display-currency-from-region", () => ({
  useDisplayCurrencyFromRegion: () => mockDisplayCurrencyFromRegion(),
}))

describe("DisplayCurrencyFromRegionMount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("mounts the region default hook exactly once per render", () => {
    render(<DisplayCurrencyFromRegionMount />)

    expect(mockDisplayCurrencyFromRegion).toHaveBeenCalledTimes(1)
  })

  it("renders null so it contributes no UI to the tree", () => {
    const { toJSON } = render(<DisplayCurrencyFromRegionMount />)

    expect(toJSON()).toBeNull()
  })
})
