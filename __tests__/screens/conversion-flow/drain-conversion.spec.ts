import { renderHook } from "@testing-library/react-native"

import {
  DrainConversionReturn,
  armMigrationConversion,
  armModeSelectionConversion,
  resetDrainConversionArmed,
  useConsumeDrainConversionArmed,
} from "@app/screens/conversion-flow/drain-conversion"

describe("drain conversion arming", () => {
  beforeEach(() => {
    resetDrainConversionArmed()
  })

  it("is not armed by default", () => {
    const { result } = renderHook(() => useConsumeDrainConversionArmed())

    expect(result.current).toBeNull()
  })

  it("reads the migration arm with its return destination", () => {
    armMigrationConversion()

    const { result } = renderHook(() => useConsumeDrainConversionArmed())

    expect(result.current).toBe(DrainConversionReturn.Migration)
  })

  it("reads the mode-selection arm with its return destination", () => {
    armModeSelectionConversion()

    const { result } = renderHook(() => useConsumeDrainConversionArmed())

    expect(result.current).toBe(DrainConversionReturn.ModeSelection)
  })

  /** The flag is one-shot: a later plain conversion never inherits a stale arm. */
  it("clears the flag so the next consumer reads null", () => {
    armMigrationConversion()
    renderHook(() => useConsumeDrainConversionArmed())

    const { result } = renderHook(() => useConsumeDrainConversionArmed())

    expect(result.current).toBeNull()
  })

  /** Consumed once on mount, the value survives re-renders, so a re-focus back onto the
   *  convert screen keeps the drain behavior. */
  it("keeps the armed value across re-renders", () => {
    armModeSelectionConversion()

    const { result, rerender } = renderHook(() => useConsumeDrainConversionArmed())
    rerender({})

    expect(result.current).toBe(DrainConversionReturn.ModeSelection)
  })

  /** Teardown drops an arm this instance never consumed (the screen was reused, not remounted),
   *  so the next plain conversion is not promoted into a drain one. */
  it("clears an arm left behind when the consumer unmounts", () => {
    const { unmount } = renderHook(() => useConsumeDrainConversionArmed())
    armMigrationConversion()

    unmount()

    const { result } = renderHook(() => useConsumeDrainConversionArmed())
    expect(result.current).toBeNull()
  })
})
