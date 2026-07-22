import { renderHook } from "@testing-library/react-native"

import {
  armMigrationConversion,
  resetMigrationConversionArmed,
  useConsumeMigrationConversionArmed,
} from "@app/screens/account-migration/hooks/use-migration-conversion"

describe("migration conversion arming", () => {
  beforeEach(() => {
    resetMigrationConversionArmed()
  })

  it("is not armed by default", () => {
    const { result } = renderHook(() => useConsumeMigrationConversionArmed())

    expect(result.current).toBe(false)
  })

  it("reads the armed flag once the gate has armed it", () => {
    armMigrationConversion()

    const { result } = renderHook(() => useConsumeMigrationConversionArmed())

    expect(result.current).toBe(true)
  })

  /** The flag is one-shot: a later plain conversion never inherits a stale arm. */
  it("clears the flag so the next consumer reads false", () => {
    armMigrationConversion()
    renderHook(() => useConsumeMigrationConversionArmed())

    const { result } = renderHook(() => useConsumeMigrationConversionArmed())

    expect(result.current).toBe(false)
  })

  /** Consumed once on mount, the value survives re-renders, so a re-focus back onto the
   *  convert screen keeps the migration behavior. */
  it("keeps the armed value across re-renders", () => {
    armMigrationConversion()

    const { result, rerender } = renderHook(() => useConsumeMigrationConversionArmed())
    rerender({})

    expect(result.current).toBe(true)
  })
})
