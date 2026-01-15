import { renderHook, act } from "@testing-library/react-hooks"
import type { RefObject } from "react"
import type { View } from "react-native"
import Share from "react-native-share"
import { captureRef } from "react-native-view-shot"

import { useScreenshot } from "@app/hooks/use-screenshot"

jest.mock("react-native-share", () => ({
  open: jest.fn(() => Promise.resolve()),
}))

jest.mock("react-native-view-shot", () => ({
  captureRef: jest.fn(() => Promise.resolve("file://screenshot.jpg")),
}))

const mockedShareOpen = Share.open as jest.Mock
const mockedCaptureRef = captureRef as jest.Mock

describe("useScreenshot", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockedShareOpen.mockClear()
    mockedCaptureRef.mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("captures and shares a screenshot", async () => {
    const viewRef = { current: {} } as RefObject<View>

    const { result } = renderHook(() => useScreenshot(viewRef))

    await act(async () => {
      const pending = result.current.captureAndShare()
      jest.advanceTimersByTime(100)
      await pending
    })

    expect(mockedCaptureRef).toHaveBeenCalledWith(viewRef, {
      format: "jpg",
      quality: 0.9,
    })
    expect(mockedShareOpen).toHaveBeenCalledWith({
      url: "file://screenshot.jpg",
      failOnCancel: false,
    })
    expect(result.current.isTakingScreenshot).toBe(false)
  })

  it("resets state on failure", async () => {
    mockedCaptureRef.mockRejectedValueOnce(new Error("capture failed"))
    const viewRef = { current: {} } as RefObject<View>

    const { result } = renderHook(() => useScreenshot(viewRef))

    await act(async () => {
      const pending = result.current.captureAndShare()
      jest.advanceTimersByTime(100)
      await pending
    })

    expect(mockedShareOpen).not.toHaveBeenCalled()
    expect(result.current.isTakingScreenshot).toBe(false)
  })
})
