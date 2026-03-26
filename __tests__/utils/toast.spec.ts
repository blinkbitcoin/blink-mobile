import Toast from "react-native-toast-message"

import { toastShow } from "@app/utils/toast"

const mockLogToastShown = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logToastShown: (...args: readonly unknown[]) => mockLogToastShown(...args),
}))

jest.mock("@app/i18n/i18n-util", () => ({
  i18nObject: () => ({
    common: {
      error: () => "Error",
      success: () => "Success",
      warning: () => "Warning",
    },
  }),
}))

const mockLL = {
  common: {
    error: () => "Error",
    success: () => "Success",
    warning: () => "Warning",
  },
} as Parameters<typeof toastShow>[0]["LL"]

describe("toastShow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("shows error toast by default", () => {
    const showSpy = jest.spyOn(Toast, "show")

    toastShow({ message: "Something failed", LL: mockLL })

    expect(showSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        text1: "Error",
        text2: "Something failed",
      }),
    )
  })

  it("shows success toast with correct title", () => {
    const showSpy = jest.spyOn(Toast, "show")

    toastShow({ message: "Done!", LL: mockLL, type: "success" })

    expect(showSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        text1: "Success",
        text2: "Done!",
      }),
    )
  })

  it("shows warning toast with correct title", () => {
    const showSpy = jest.spyOn(Toast, "show")

    toastShow({ message: "Be careful", LL: mockLL, type: "warning" })

    expect(showSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "warning",
        text1: "Warning",
        text2: "Be careful",
      }),
    )
  })

  it("resolves message function with translations", () => {
    const showSpy = jest.spyOn(Toast, "show")

    toastShow({
      message: () => "Translated message",
      LL: mockLL,
    })

    expect(showSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        text2: "Translated message",
      }),
    )
  })

  it("logs toast shown event", () => {
    toastShow({ message: "Test", LL: mockLL, type: "warning" })

    expect(mockLogToastShown).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Test",
        type: "warning",
      }),
    )
  })
})
