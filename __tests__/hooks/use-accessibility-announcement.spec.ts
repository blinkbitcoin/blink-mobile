import { it } from "@jest/globals"
import { AccessibilityInfo } from "react-native"
import { act, renderHook } from "@testing-library/react-native"

import { useAccessibilityAnnouncement } from "@app/hooks/use-accessibility-announcement"

type Props = { message: string | null | undefined }

const announce = () => jest.mocked(AccessibilityInfo.announceForAccessibility)

const renderAnnouncement = (
  message: Props["message"],
  options?: Parameters<typeof useAccessibilityAnnouncement>[1],
) =>
  renderHook(({ message }: Props) => useAccessibilityAnnouncement(message, options), {
    initialProps: { message },
  })

describe("useAccessibilityAnnouncement", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {})
    // React Native's jest setup already makes it a mock, so restoring never clears it.
    announce().mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it("speaks the message it opens with", () => {
    renderAnnouncement("Low funds")
    act(() => jest.runAllTimers())

    expect(announce()).toHaveBeenCalledWith("Low funds")
  })

  it("stays quiet about the opening message with skipInitial, and speaks the next one", () => {
    const { rerender } = renderAnnouncement("$5.00", { skipInitial: true })
    act(() => jest.runAllTimers())

    expect(announce()).not.toHaveBeenCalled()

    rerender({ message: "$5.50" })
    act(() => jest.runAllTimers())

    expect(announce()).toHaveBeenCalledTimes(1)
    expect(announce()).toHaveBeenCalledWith("$5.50")
  })

  it.each([undefined, null, ""])("says nothing for an empty message (%p)", (message) => {
    renderAnnouncement(message)
    act(() => jest.runAllTimers())

    expect(announce()).not.toHaveBeenCalled()
  })

  it("speaks a message again once it cleared and came back", () => {
    const { rerender } = renderAnnouncement("Low funds")
    act(() => jest.runAllTimers())
    rerender({ message: undefined })
    act(() => jest.runAllTimers())
    rerender({ message: "Low funds" })
    act(() => jest.runAllTimers())

    expect(announce()).toHaveBeenCalledTimes(2)
  })

  it("waits out delayMs before speaking", () => {
    renderAnnouncement("$5.00", { delayMs: 500 })

    act(() => jest.advanceTimersByTime(499))
    expect(announce()).not.toHaveBeenCalled()

    act(() => jest.advanceTimersByTime(1))
    expect(announce()).toHaveBeenCalledWith("$5.00")
  })

  it("speaks a quick run of changes once, at its end", () => {
    const { rerender } = renderAnnouncement("$5", { delayMs: 500 })
    act(() => jest.advanceTimersByTime(200))
    rerender({ message: "$55" })
    act(() => jest.advanceTimersByTime(200))
    rerender({ message: "$555" })
    act(() => jest.runAllTimers())

    expect(announce()).toHaveBeenCalledTimes(1)
    expect(announce()).toHaveBeenCalledWith("$555")
  })

  it("drops a pending announcement on unmount", () => {
    const { unmount } = renderAnnouncement("$5.00", { delayMs: 500 })
    unmount()
    act(() => jest.runAllTimers())

    expect(announce()).not.toHaveBeenCalled()
  })
})
