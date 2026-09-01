import { renderHook } from "@testing-library/react-native"

import { useLevel } from "@app/graphql/level-context"

describe("useLevel", () => {
  it("defaults every gate to closed while no level has loaded", () => {
    // The context default is what a screen sees while the level query is still
    // in flight, and features like add-a-place are gated on it — so it has to
    // fail closed rather than flash them on for an account that turns out to
    // be below level two.
    const { result } = renderHook(() => useLevel())

    expect(result.current.isAtLeastLevelZero).toBe(false)
    expect(result.current.isAtLeastLevelOne).toBe(false)
    expect(result.current.isAtLeastLevelTwo).toBe(false)
    expect(result.current.isAtLeastLevelThree).toBe(false)
    expect(result.current.currentLevel).toBe("NonAuth")
  })
})
