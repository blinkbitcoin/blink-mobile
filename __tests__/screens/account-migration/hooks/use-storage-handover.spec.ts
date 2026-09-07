import { act, renderHook } from "@testing-library/react-native"

import {
  isStorageReadFailure,
  MAX_RETRIES_BEFORE_STORAGE_HANDOVER,
  useStorageHandover,
} from "@app/screens/account-migration/hooks/use-storage-handover"

import { flushEffects } from "../../../helpers/flush-effects"

const mockReportError = jest.fn()

jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (operation: string, err: unknown) => mockReportError(operation, err),
}))

/**
 * The gate's three inputs, as the storage branch sees them: a locked migration whose local
 * reads failed while the server answered fine.
 */
const storageFailureInputs = {
  isMigrationLocked: true,
  hasResumeDataError: true,
  hasServerDataError: false,
}

describe("isStorageReadFailure", () => {
  it("is the device's failure when the account is locked and only the local reads failed", () => {
    expect(isStorageReadFailure(storageFailureInputs)).toBe(true)
  })

  /** The guard the gate cannot show: an unlocked account with only a storage error never
   *  renders an error screen, and nothing strands the user, so no escape is owed. */
  it("is not the device's failure while the account is unlocked", () => {
    expect(
      isStorageReadFailure({ ...storageFailureInputs, isMigrationLocked: false }),
    ).toBe(false)
  })

  it("is not the device's failure when the local reads answered", () => {
    expect(
      isStorageReadFailure({ ...storageFailureInputs, hasResumeDataError: false }),
    ).toBe(false)
  })

  /** A user who is offline as well would be sent looking at their phone for the network's
   *  problem, so a server failure masks the storage branch outright. */
  it("is not the device's failure while a server read also failed", () => {
    expect(
      isStorageReadFailure({ ...storageFailureInputs, hasServerDataError: true }),
    ).toBe(false)
  })
})

describe("useStorageHandover", () => {
  const renderHandover = (
    overrides: Partial<Parameters<typeof useStorageHandover>[0]> = {},
  ) =>
    renderHook(
      (props: Partial<Parameters<typeof useStorageHandover>[0]>) =>
        useStorageHandover({
          ...storageFailureInputs,
          refetchGateData: () => Promise.resolve([]),
          ...overrides,
          ...props,
        }),
      { initialProps: {} },
    )

  const retryTimes = async (
    result: { current: { retry: () => Promise<void> } },
    times: number,
  ): Promise<void> => {
    for (let attempt = 0; attempt < times; attempt += 1) {
      await act(async () => {
        await result.current.retry()
      })
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("offers no escape before the retries have been spent", async () => {
    const { result } = renderHandover()

    await retryTimes(result, MAX_RETRIES_BEFORE_STORAGE_HANDOVER - 1)

    expect(result.current.shouldOfferHandover).toBe(false)
  })

  it("offers the escape once retrying has stopped being a fix", async () => {
    const { result } = renderHandover()

    await retryTimes(result, MAX_RETRIES_BEFORE_STORAGE_HANDOVER)

    expect(result.current.shouldOfferHandover).toBe(true)
  })

  /** The run ends when a read finally lands, and its attempts must not carry into the
   *  next one. */
  it("forgets the attempts once the store has answered", async () => {
    const { result, rerender } = renderHandover()

    await retryTimes(result, MAX_RETRIES_BEFORE_STORAGE_HANDOVER - 1)

    rerender({ hasResumeDataError: false })
    await flushEffects()
    rerender({ hasResumeDataError: true })
    await flushEffects()

    await retryTimes(result, 1)

    expect(result.current.shouldOfferHandover).toBe(false)
  })

  /** Retries made while the network was the problem say nothing about this device. */
  it("does not count a retry made against a server failure", async () => {
    const { result, rerender } = renderHandover({ hasServerDataError: true })

    await retryTimes(result, MAX_RETRIES_BEFORE_STORAGE_HANDOVER)

    rerender({ hasServerDataError: false })
    await flushEffects()

    expect(result.current.shouldOfferHandover).toBe(false)
  })

  /** The count rises when a retry starts, so between the last tap and its answer the escape
   *  would be offered over a read that may still succeed. */
  it("hides the escape while the deciding retry is still in flight", async () => {
    let settleLastRefetch: () => void = () => undefined
    let isLastAttempt = false
    const refetchGateData = () =>
      isLastAttempt
        ? new Promise<void>((resolve) => {
            settleLastRefetch = () => resolve()
          })
        : Promise.resolve()

    const { result } = renderHandover({ refetchGateData })

    await retryTimes(result, MAX_RETRIES_BEFORE_STORAGE_HANDOVER - 1)
    isLastAttempt = true

    let inFlightRetry: Promise<void> = Promise.resolve()
    act(() => {
      inFlightRetry = result.current.retry()
    })

    expect(result.current.isRetrying).toBe(true)
    expect(result.current.shouldOfferHandover).toBe(false)

    await act(async () => {
      settleLastRefetch()
      await inFlightRetry
    })

    expect(result.current.isRetrying).toBe(false)
    expect(result.current.shouldOfferHandover).toBe(true)
  })

  it("reports a refetch that rejects rather than failing silently", async () => {
    const { result } = renderHandover({
      refetchGateData: () => Promise.reject(new Error("offline")),
    })

    await retryTimes(result, 1)

    expect(mockReportError).toHaveBeenCalledWith(
      "Migration gate retry",
      expect.any(Error),
    )
    expect(result.current.isRetrying).toBe(false)
  })

  it("reports the storage branch so the gate can pick its copy", () => {
    const { result } = renderHandover()

    expect(result.current.isStorageReadFailure).toBe(true)
  })
})
