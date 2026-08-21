import { renderHook, act } from "@testing-library/react-native"

import { useClipboard } from "@app/hooks/use-clipboard"

const mockSetString = jest.fn()
const mockGetString = jest.fn(() => Promise.resolve(""))
const mockToastShow = jest.fn()

jest.mock("@react-native-clipboard/clipboard", () => ({
  setString: (content: string) => mockSetString(content),
  getString: () => mockGetString(),
}))

const flushMicrotasks = async () =>
  act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })

jest.mock("@app/utils/toast", () => ({
  toastShow: (params: { type: string; message: string }) => mockToastShow(params),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: {
        copied: () => "Copied to clipboard",
      },
    },
  }),
}))

describe("useClipboard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe("copyToClipboard", () => {
    it("copies content to clipboard", () => {
      const { result } = renderHook(() => useClipboard())

      act(() => {
        result.current.copyToClipboard({ content: "test content" })
      })

      expect(mockSetString).toHaveBeenCalledWith("test content")
    })

    it("shows default toast message when no custom message provided", () => {
      const { result } = renderHook(() => useClipboard())

      act(() => {
        result.current.copyToClipboard({ content: "test content" })
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
          message: "Copied to clipboard",
        }),
      )
    })

    it("shows custom toast message when provided", () => {
      const { result } = renderHook(() => useClipboard())

      act(() => {
        result.current.copyToClipboard({
          content: "test content",
          message: "Custom message",
        })
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
          message: "Custom message",
        }),
      )
    })

    it("copies different content values correctly", () => {
      const { result } = renderHook(() => useClipboard())

      act(() => {
        result.current.copyToClipboard({ content: "first" })
      })

      act(() => {
        result.current.copyToClipboard({ content: "second" })
      })

      expect(mockSetString).toHaveBeenNthCalledWith(1, "first")
      expect(mockSetString).toHaveBeenNthCalledWith(2, "second")
    })

    it("handles empty string content", () => {
      const { result } = renderHook(() => useClipboard())

      act(() => {
        result.current.copyToClipboard({ content: "" })
      })

      expect(mockSetString).toHaveBeenCalledWith("")
      expect(mockToastShow).toHaveBeenCalled()
    })

    it("handles content with special characters", () => {
      const { result } = renderHook(() => useClipboard())
      const specialContent = 'test@#$%^&*()_+={}[]|\\:";<>?,./'

      act(() => {
        result.current.copyToClipboard({ content: specialContent })
      })

      expect(mockSetString).toHaveBeenCalledWith(specialContent)
    })
  })

  describe("auto-clear", () => {
    it("clears clipboard after specified delay when it still holds the copied content", async () => {
      mockGetString.mockResolvedValue("secret")
      const { result } = renderHook(() => useClipboard(5000))

      act(() => {
        result.current.copyToClipboard({ content: "secret" })
      })

      expect(mockSetString).toHaveBeenCalledWith("secret")
      mockSetString.mockClear()

      act(() => {
        jest.advanceTimersByTime(5000)
      })
      await flushMicrotasks()

      expect(mockSetString).toHaveBeenCalledWith("")
    })

    it("leaves the clipboard alone when the user has since copied something else", async () => {
      mockGetString.mockResolvedValue("something else entirely")
      const { result } = renderHook(() => useClipboard(5000))

      act(() => {
        result.current.copyToClipboard({ content: "secret" })
      })
      mockSetString.mockClear()

      act(() => {
        jest.advanceTimersByTime(5000)
      })
      await flushMicrotasks()

      expect(mockSetString).not.toHaveBeenCalled()
    })

    it("does not clear clipboard when clearAfterMs is not provided", () => {
      const { result } = renderHook(() => useClipboard())

      act(() => {
        result.current.copyToClipboard({ content: "persistent" })
      })

      mockSetString.mockClear()

      act(() => {
        jest.advanceTimersByTime(120_000)
      })

      expect(mockSetString).not.toHaveBeenCalled()
    })

    it("resets timer on subsequent copy", async () => {
      mockGetString.mockResolvedValue("second")
      const { result } = renderHook(() => useClipboard(5000))

      act(() => {
        result.current.copyToClipboard({ content: "first" })
      })

      act(() => {
        jest.advanceTimersByTime(3000)
      })

      act(() => {
        result.current.copyToClipboard({ content: "second" })
      })

      mockSetString.mockClear()

      act(() => {
        jest.advanceTimersByTime(3000)
      })
      await flushMicrotasks()

      expect(mockSetString).not.toHaveBeenCalled()

      act(() => {
        jest.advanceTimersByTime(2000)
      })
      await flushMicrotasks()

      expect(mockSetString).toHaveBeenCalledWith("")
    })

    it("clears a pending secret immediately when the consumer unmounts", async () => {
      mockGetString.mockResolvedValue("test")
      const { result, unmount } = renderHook(() => useClipboard(5000))

      act(() => {
        result.current.copyToClipboard({ content: "test" })
      })

      mockSetString.mockClear()
      unmount()
      await flushMicrotasks()

      expect(mockSetString).toHaveBeenCalledWith("")
    })

    it("does not clear again after the delay when unmount already cleared", async () => {
      mockGetString.mockResolvedValue("test")
      const { result, unmount } = renderHook(() => useClipboard(5000))

      act(() => {
        result.current.copyToClipboard({ content: "test" })
      })

      unmount()
      await flushMicrotasks()
      mockSetString.mockClear()

      act(() => {
        jest.advanceTimersByTime(10_000)
      })
      await flushMicrotasks()

      expect(mockSetString).not.toHaveBeenCalled()
    })

    it("does not touch the clipboard on unmount when no timed copy is pending", async () => {
      mockGetString.mockResolvedValue("persistent")
      const { result, unmount } = renderHook(() => useClipboard())

      act(() => {
        result.current.copyToClipboard({ content: "persistent" })
      })

      mockSetString.mockClear()
      unmount()
      await flushMicrotasks()

      expect(mockSetString).not.toHaveBeenCalled()
    })
  })
})
