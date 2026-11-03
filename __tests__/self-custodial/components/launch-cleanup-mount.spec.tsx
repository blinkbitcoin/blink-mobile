import React from "react"
import { render } from "@testing-library/react-native"

const mockFinishPendingSdkLogReset = jest.fn()
jest.mock("@app/self-custodial/diagnostics/sdk-log-files", () => ({
  finishPendingSdkLogReset: () => mockFinishPendingSdkLogReset(),
}))

const mockFinishPendingStorageRemovals = jest.fn()
jest.mock("@app/self-custodial/storage/storage-removal", () => ({
  finishPendingStorageRemovals: () => mockFinishPendingStorageRemovals(),
}))

import { LaunchCleanupMount } from "@app/self-custodial/components/launch-cleanup-mount"

describe("LaunchCleanupMount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFinishPendingSdkLogReset.mockResolvedValue(undefined)
    mockFinishPendingStorageRemovals.mockResolvedValue(undefined)
  })

  it("finishes a pending log reset and storage removals once at app start, rendering nothing", () => {
    const { toJSON, rerender } = render(<LaunchCleanupMount />)
    rerender(<LaunchCleanupMount />)

    expect(toJSON()).toBeNull()
    expect(mockFinishPendingSdkLogReset).toHaveBeenCalledTimes(1)
    expect(mockFinishPendingStorageRemovals).toHaveBeenCalledTimes(1)
  })
})
