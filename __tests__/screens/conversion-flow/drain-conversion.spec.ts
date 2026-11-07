import { renderHook } from "@testing-library/react-native"

import {
  DrainConversionReturn,
  armInvestmentConversion,
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

    expect(result.current).toEqual({ target: DrainConversionReturn.Migration })
  })

  it("reads the mode-selection arm with its return destination", () => {
    armModeSelectionConversion()

    const { result } = renderHook(() => useConsumeDrainConversionArmed())

    expect(result.current).toEqual({ target: DrainConversionReturn.ModeSelection })
  })

  /**
   * The investment step resumes on a figure the investor chose several screens earlier,
   * which nothing downstream can work out, so the arm carries it through the conversion.
   */
  it("reads the investment arm with the amount it has to come back to", () => {
    armInvestmentConversion(500)

    const { result } = renderHook(() => useConsumeDrainConversionArmed())

    expect(result.current).toEqual({
      target: DrainConversionReturn.Investment,
      selectedAmountUsd: 500,
    })
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

    expect(result.current).toEqual({ target: DrainConversionReturn.ModeSelection })
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
