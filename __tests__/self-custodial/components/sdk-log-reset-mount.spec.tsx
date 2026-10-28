import React from "react"
import { render } from "@testing-library/react-native"

const mockFinishPendingSdkLogReset = jest.fn()
jest.mock("@app/self-custodial/diagnostics/sdk-log-files", () => ({
  finishPendingSdkLogReset: () => mockFinishPendingSdkLogReset(),
}))

import { SdkLogResetMount } from "@app/self-custodial/components/sdk-log-reset-mount"

describe("SdkLogResetMount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFinishPendingSdkLogReset.mockResolvedValue(undefined)
  })

  it("finishes a pending log reset once at app start, rendering nothing", () => {
    const { toJSON, rerender } = render(<SdkLogResetMount />)
    rerender(<SdkLogResetMount />)

    expect(toJSON()).toBeNull()
    expect(mockFinishPendingSdkLogReset).toHaveBeenCalledTimes(1)
  })
})
