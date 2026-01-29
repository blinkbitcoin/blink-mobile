import { renderHook, act } from "@testing-library/react-hooks"

import { useClipboard } from "@app/hooks/use-clipboard"

const mockSetString = jest.fn()
const mockToastShow = jest.fn()

jest.mock("@react-native-clipboard/clipboard", () => ({
  setString: (content: string) => mockSetString(content),
}))

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
})
