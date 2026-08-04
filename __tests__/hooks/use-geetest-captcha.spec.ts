/* eslint-disable camelcase -- geetest native payloads use snake_case keys */
import { act, renderHook } from "@testing-library/react-native"
import { DeviceEventEmitter, NativeModules } from "react-native"

import { useGeetestCaptcha } from "@app/hooks/use-geetest-captcha"

const DIALOG_RESULT_EVENT = "GT3-->onDialogResult-->"
const FAILED_EVENT = "GT3-->onFailed-->"

// Values the hook short-circuits on, matching the apollo MockedProvider fixtures
const MOCKED_GT = "d5cdc22925d10bc4720d012ba48dd214"
const MOCKED_CHALLENGE = "af073125d936ff9e5aa4c1ed44a38d5d"

const mockCaptchaCreateChallenge = jest.fn()
let mockLoading = false

jest.mock("@app/graphql/generated", () => ({
  useCaptchaCreateChallengeMutation: () => [
    mockCaptchaCreateChallenge,
    { loading: mockLoading },
  ],
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      errors: { generic: () => "Something went wrong" },
    },
  }),
}))

const mockLogStartCaptcha = jest.fn()

jest.mock("@app/utils/analytics", () => ({
  logStartCaptcha: () => mockLogStartCaptcha(),
}))

const mockSetUp = jest.fn()
const mockTearDown = jest.fn()
const mockHandleRegisteredGeeTestCaptcha = jest.fn()

jest.mock("@blinkbitcoin/react-native-geetest-module", () => ({
  __esModule: true,
  default: {
    setUp: () => mockSetUp(),
    tearDown: () => mockTearDown(),
    handleRegisteredGeeTestCaptcha: (params: string) =>
      mockHandleRegisteredGeeTestCaptcha(params),
  },
}))

// The hook builds a real NativeEventEmitter, which requires a native module
// exposing addListener/removeListeners (and a non-null one on iOS).
NativeModules.GeetestModule = {
  addListener: jest.fn(),
  removeListeners: jest.fn(),
}

const challengeResult = (overrides: Record<string, unknown> = {}) => ({
  data: {
    captchaCreateChallenge: {
      errors: [],
      result: {
        id: "gt-id",
        challengeCode: "challenge-code",
        newCaptcha: true,
        failbackMode: false,
        ...overrides,
      },
    },
  },
})

const lastRegisteredParams = () =>
  JSON.parse(mockHandleRegisteredGeeTestCaptcha.mock.calls.at(-1)?.[0] as string)

describe("useGeetestCaptcha", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLoading = false
    mockCaptchaCreateChallenge.mockResolvedValue(challengeResult())
    DeviceEventEmitter.removeAllListeners(DIALOG_RESULT_EVENT)
    DeviceEventEmitter.removeAllListeners(FAILED_EVENT)
  })

  it("starts with no error and no validation data", () => {
    const { result } = renderHook(() => useGeetestCaptcha())

    expect(result.current.geetestError).toBeNull()
    expect(result.current.geetestValidationData).toBeNull()
    expect(result.current.loadingRegisterCaptcha).toBe(false)
  })

  it("exposes the mutation loading state", () => {
    mockLoading = true

    const { result } = renderHook(() => useGeetestCaptcha())

    expect(result.current.loadingRegisterCaptcha).toBe(true)
  })

  describe("native module lifecycle", () => {
    it("sets up the module on mount and tears it down on unmount", () => {
      const { unmount } = renderHook(() => useGeetestCaptcha())

      expect(mockSetUp).toHaveBeenCalledTimes(1)
      expect(mockTearDown).not.toHaveBeenCalled()

      unmount()

      expect(mockTearDown).toHaveBeenCalledTimes(1)
    })

    it("subscribes to both geetest events on mount", () => {
      renderHook(() => useGeetestCaptcha())

      expect(DeviceEventEmitter.listenerCount(DIALOG_RESULT_EVENT)).toBe(1)
      expect(DeviceEventEmitter.listenerCount(FAILED_EVENT)).toBe(1)
    })

    it("removes both listeners on unmount", () => {
      const { unmount } = renderHook(() => useGeetestCaptcha())

      unmount()

      expect(DeviceEventEmitter.listenerCount(DIALOG_RESULT_EVENT)).toBe(0)
      expect(DeviceEventEmitter.listenerCount(FAILED_EVENT)).toBe(0)
    })
  })

  describe("registerCaptcha", () => {
    it("logs the analytics event and requests a challenge", async () => {
      const { result } = renderHook(() => useGeetestCaptcha())

      await act(async () => {
        await result.current.registerCaptcha()
      })

      expect(mockLogStartCaptcha).toHaveBeenCalledTimes(1)
      expect(mockCaptchaCreateChallenge).toHaveBeenCalledTimes(1)
    })

    it("forwards the challenge to the native module with success=1 when failbackMode is false", async () => {
      const { result } = renderHook(() => useGeetestCaptcha())

      await act(async () => {
        await result.current.registerCaptcha()
      })

      expect(mockHandleRegisteredGeeTestCaptcha).toHaveBeenCalledTimes(1)
      expect(lastRegisteredParams()).toEqual({
        success: 1,
        challenge: "challenge-code",
        gt: "gt-id",
        new_captcha: true,
      })
      expect(result.current.geetestError).toBeNull()
    })

    it("sends success=0 when the challenge is in failback mode", async () => {
      mockCaptchaCreateChallenge.mockResolvedValue(
        challengeResult({ failbackMode: true, newCaptcha: false }),
      )
      const { result } = renderHook(() => useGeetestCaptcha())

      await act(async () => {
        await result.current.registerCaptcha()
      })

      expect(lastRegisteredParams()).toEqual({
        success: 0,
        challenge: "challenge-code",
        gt: "gt-id",
        new_captcha: false,
      })
    })

    it("sets the first error message and skips the native module when the mutation returns errors", async () => {
      mockCaptchaCreateChallenge.mockResolvedValue({
        data: {
          captchaCreateChallenge: {
            errors: [{ message: "captcha unavailable" }, { message: "second error" }],
            result: null,
          },
        },
      })
      const { result } = renderHook(() => useGeetestCaptcha())

      await act(async () => {
        await result.current.registerCaptcha()
      })

      expect(result.current.geetestError).toBe("captcha unavailable")
      expect(mockHandleRegisteredGeeTestCaptcha).not.toHaveBeenCalled()
    })

    it("sets a generic error when there is neither a result nor errors", async () => {
      mockCaptchaCreateChallenge.mockResolvedValue({
        data: { captchaCreateChallenge: { errors: [], result: null } },
      })
      const { result } = renderHook(() => useGeetestCaptcha())

      await act(async () => {
        await result.current.registerCaptcha()
      })

      expect(result.current.geetestError).toBe("Something went wrong")
      expect(mockHandleRegisteredGeeTestCaptcha).not.toHaveBeenCalled()
    })

    it("sets a generic error when the mutation returns no data at all", async () => {
      mockCaptchaCreateChallenge.mockResolvedValue({ data: null })
      const { result } = renderHook(() => useGeetestCaptcha())

      await act(async () => {
        await result.current.registerCaptcha()
      })

      expect(result.current.geetestError).toBe("Something went wrong")
      expect(mockHandleRegisteredGeeTestCaptcha).not.toHaveBeenCalled()
    })

    it("short-circuits with canned validation data for the mocked test challenge", async () => {
      mockCaptchaCreateChallenge.mockResolvedValue(
        challengeResult({ id: MOCKED_GT, challengeCode: MOCKED_CHALLENGE }),
      )
      const { result } = renderHook(() => useGeetestCaptcha())

      await act(async () => {
        await result.current.registerCaptcha()
      })

      expect(result.current.geetestValidationData).toEqual({
        geetestChallenge: "af073125d936ff9e5aa4c1ed44a38d5d4s",
        geetestSecCode: "290cc148dfb39afb5af63320469facd6",
        geetestValidate: "290cc148dfb39afb5af63320469facd6|jordan",
      })
      expect(mockHandleRegisteredGeeTestCaptcha).not.toHaveBeenCalled()
    })

    it("does not short-circuit when only the mocked id matches", async () => {
      mockCaptchaCreateChallenge.mockResolvedValue(challengeResult({ id: MOCKED_GT }))
      const { result } = renderHook(() => useGeetestCaptcha())

      await act(async () => {
        await result.current.registerCaptcha()
      })

      expect(result.current.geetestValidationData).toBeNull()
      expect(mockHandleRegisteredGeeTestCaptcha).toHaveBeenCalledTimes(1)
    })
  })

  describe("dialog result event", () => {
    it("stores the validation data when the captcha succeeds", async () => {
      const { result } = renderHook(() => useGeetestCaptcha())

      await act(async () => {
        DeviceEventEmitter.emit(DIALOG_RESULT_EVENT, {
          result: JSON.stringify({
            geetest_challenge: "challenge",
            geetest_seccode: "seccode",
            geetest_validate: "validate",
          }),
        })
      })

      expect(result.current.geetestValidationData).toEqual({
        geetestChallenge: "challenge",
        geetestSecCode: "seccode",
        geetestValidate: "validate",
      })
    })

    it("ignores a failed captcha result carrying an empty challenge", async () => {
      const { result } = renderHook(() => useGeetestCaptcha())

      await act(async () => {
        DeviceEventEmitter.emit(DIALOG_RESULT_EVENT, {
          result: JSON.stringify({ geetest_challenge: "" }),
        })
      })

      expect(result.current.geetestValidationData).toBeNull()
    })

    it("ignores a partial result missing the seccode or validate fields", async () => {
      const { result } = renderHook(() => useGeetestCaptcha())

      await act(async () => {
        DeviceEventEmitter.emit(DIALOG_RESULT_EVENT, {
          result: JSON.stringify({
            geetest_challenge: "challenge",
            geetest_seccode: "seccode",
          }),
        })
      })

      expect(result.current.geetestValidationData).toBeNull()
    })
  })

  describe("failure event", () => {
    it("stores the error reported by the native module", async () => {
      const { result } = renderHook(() => useGeetestCaptcha())

      await act(async () => {
        DeviceEventEmitter.emit(FAILED_EVENT, { error: "geetest failed" })
      })

      expect(result.current.geetestError).toBe("geetest failed")
    })
  })

  describe("resetters", () => {
    it("resetError clears a previously reported error", async () => {
      const { result } = renderHook(() => useGeetestCaptcha())

      await act(async () => {
        DeviceEventEmitter.emit(FAILED_EVENT, { error: "geetest failed" })
      })
      expect(result.current.geetestError).toBe("geetest failed")

      act(() => {
        result.current.resetError()
      })

      expect(result.current.geetestError).toBeNull()
    })

    it("resetValidationData clears previously stored validation data", async () => {
      mockCaptchaCreateChallenge.mockResolvedValue(
        challengeResult({ id: MOCKED_GT, challengeCode: MOCKED_CHALLENGE }),
      )
      const { result } = renderHook(() => useGeetestCaptcha())

      await act(async () => {
        await result.current.registerCaptcha()
      })
      expect(result.current.geetestValidationData).not.toBeNull()

      act(() => {
        result.current.resetValidationData()
      })

      expect(result.current.geetestValidationData).toBeNull()
    })
  })
})
