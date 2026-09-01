import { renderHook, act } from "@testing-library/react-native"
import { Alert } from "react-native"

import { useKycFlow } from "@app/hooks/use-kyc-flow"
import { KycFlowType } from "@app/graphql/generated"

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}))

jest.mock("@rn-vui/themed", () => ({
  useTheme: () => ({
    theme: { mode: "light" },
  }),
}))

const mockKycFlowStart = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  useKycFlowStartMutation: () => [mockKycFlowStart],
  KycFlowType: {
    Card: "CARD",
    UpgradeLevelTwo: "UPGRADE_LEVEL_TWO",
  },
}))

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({
    appConfig: {
      galoyInstance: {
        kycUrl: "https://kyc.test",
      },
    },
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      FullOnboarding: { error: () => "Error" },
      GaloyAddressScreen: { somethingWentWrong: () => "Something went wrong" },
      common: { ok: () => "OK" },
      UpgradeAccountModal: { title: () => "Upgrade Account" },
    },
    locale: "en",
  }),
}))

jest.mock("@app/navigation/stack-param-lists", () => ({}))

jest.spyOn(Alert, "alert")

type RecordedAlertButton = { text?: string; onPress?: () => void }

// jest.clearAllMocks() in beforeEach zeroes the Alert spy too, so index 0 is
// always the alert raised by the current test.
const recordedAlertButtons = (): RecordedAlertButton[] =>
  ((Alert.alert as jest.Mock).mock.calls[0][2] ?? []) as RecordedAlertButton[]

const navigatedUrl = (): string => mockNavigate.mock.calls[0][1].url as string

describe("useKycFlow", () => {
  let activeConsoleErrorSpy: jest.SpyInstance | undefined

  // Silences the console.error the hook logs for a failure the test programmed,
  // and hands it back so the test can assert the log happened. Restoring from
  // afterEach rather than at the end of each test is what makes it leak-proof:
  // an assertion failing first would skip an inline mockRestore() and leave
  // console.error muted for every test after it, exactly when the suite is
  // already red and its output matters most.
  const captureConsoleError = () => {
    activeConsoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    return activeConsoleErrorSpy
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    activeConsoleErrorSpy?.mockRestore()
    activeConsoleErrorSpy = undefined
  })

  it("returns loading false initially", () => {
    const { result } = renderHook(() => useKycFlow())

    expect(result.current.loading).toBe(false)
  })

  it("calls mutation and navigates to webView on startKyc", async () => {
    mockKycFlowStart.mockResolvedValue({
      data: {
        kycFlowStart: {
          tokenWeb: "test-token",
          workflowRunId: "wf-123",
        },
      },
    })

    const { result } = renderHook(() => useKycFlow())

    await act(async () => {
      await result.current.startKyc()
    })

    expect(mockKycFlowStart).toHaveBeenCalledWith({
      variables: {
        input: { firstName: undefined, lastName: undefined, type: undefined },
      },
    })
    expect(mockNavigate).toHaveBeenCalledWith("webView", {
      url: expect.stringContaining("https://kyc.test/webflow?"),
      headerTitle: "Upgrade Account",
    })
  })

  it("passes firstName, lastName, type to mutation input", async () => {
    mockKycFlowStart.mockResolvedValue({
      data: {
        kycFlowStart: {
          tokenWeb: "t",
          workflowRunId: "w",
        },
      },
    })

    const { result } = renderHook(() =>
      useKycFlow({ firstName: "John", lastName: "Doe", type: KycFlowType.Card }),
    )

    await act(async () => {
      await result.current.startKyc()
    })

    expect(mockKycFlowStart).toHaveBeenCalledWith({
      variables: {
        input: { firstName: "John", lastName: "Doe", type: KycFlowType.Card },
      },
    })
  })

  // Asserted as one exact URL rather than a handful of toContain() calls: every
  // substring survives a URL whose separators are broken (a doubled "&", a second
  // "?"), so a fragment-wise assertion cannot see the join it is named after.
  it("builds the webflow URL from the token, locale, theme mode and workflow run id", async () => {
    mockKycFlowStart.mockResolvedValue({
      data: {
        kycFlowStart: {
          tokenWeb: "abc",
          workflowRunId: "wf-1",
        },
      },
    })

    const { result } = renderHook(() => useKycFlow())

    await act(async () => {
      await result.current.startKyc()
    })

    expect(navigatedUrl()).toBe(
      "https://kyc.test/webflow?token=abc&lang=en&theme=light&workflow_run_id=wf-1",
    )
  })

  it("omits workflow_run_id when the mutation returns an empty workflowRunId", async () => {
    mockKycFlowStart.mockResolvedValue({
      data: {
        kycFlowStart: {
          tokenWeb: "abc",
          workflowRunId: "",
        },
      },
    })

    const { result } = renderHook(() => useKycFlow())

    await act(async () => {
      await result.current.startKyc()
    })

    expect(navigatedUrl()).toBe("https://kyc.test/webflow?token=abc&lang=en&theme=light")
  })

  // Characterization, not approval: when the mutation resolves without a payload
  // the hook treats it as success and pushes the webflow an empty token, where the
  // user meets the KYC vendor's own error page instead of our error alert. If the
  // hook is changed to reject that case, rewrite this test deliberately rather
  // than deleting it.
  it("navigates with an empty token when the mutation resolves without data", async () => {
    mockKycFlowStart.mockResolvedValue({})

    const { result } = renderHook(() => useKycFlow())

    await act(async () => {
      await result.current.startKyc()
    })

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(navigatedUrl()).toBe("https://kyc.test/webflow?token=&lang=en&theme=light")
  })

  it("uses default headerTitle from LL.UpgradeAccountModal.title() when not provided", async () => {
    mockKycFlowStart.mockResolvedValue({
      data: {
        kycFlowStart: {
          tokenWeb: "t",
          workflowRunId: "w",
        },
      },
    })

    const { result } = renderHook(() => useKycFlow())

    await act(async () => {
      await result.current.startKyc()
    })

    expect(mockNavigate).toHaveBeenCalledWith("webView", {
      url: expect.stringContaining("https://kyc.test"),
      headerTitle: "Upgrade Account",
    })
  })

  it("uses custom headerTitle when provided", async () => {
    mockKycFlowStart.mockResolvedValue({
      data: {
        kycFlowStart: {
          tokenWeb: "t",
          workflowRunId: "w",
        },
      },
    })

    const { result } = renderHook(() => useKycFlow({ headerTitle: "Custom Title" }))

    await act(async () => {
      await result.current.startKyc()
    })

    expect(mockNavigate).toHaveBeenCalledWith("webView", {
      url: expect.stringContaining("https://kyc.test"),
      headerTitle: "Custom Title",
    })
  })

  it("calls goBack on canceled error", async () => {
    const consoleErrorSpy = captureConsoleError()
    mockKycFlowStart.mockRejectedValue(new Error("Request canceled by user"))

    const { result } = renderHook(() => useKycFlow())

    await act(async () => {
      await result.current.startKyc()
    })

    expect(mockGoBack).toHaveBeenCalledTimes(1)
    expect(Alert.alert).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "error:",
      expect.objectContaining({ message: "Request canceled by user" }),
    )
  })

  it("shows Alert on other errors", async () => {
    const consoleErrorSpy = captureConsoleError()
    mockKycFlowStart.mockRejectedValue(new Error("Network failure"))

    const { result } = renderHook(() => useKycFlow())

    await act(async () => {
      await result.current.startKyc()
    })

    expect(Alert.alert).toHaveBeenCalledWith(
      "Error",
      expect.stringContaining("Network failure"),
      expect.arrayContaining([expect.objectContaining({ text: "OK" })]),
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "error:",
      expect.objectContaining({ message: "Network failure" }),
    )
  })

  it("does not navigate to the webView when the mutation rejects", async () => {
    const consoleErrorSpy = captureConsoleError()
    mockKycFlowStart.mockRejectedValue(new Error("Network failure"))

    const { result } = renderHook(() => useKycFlow())

    await act(async () => {
      await result.current.startKyc()
    })

    // Anchor on the programmed rejection first. An unconfigured mock resolves
    // with undefined, which throws inside the same try block and lands in the
    // same catch, so a bare negative below would pass for the wrong reason.
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "error:",
      expect.objectContaining({ message: "Network failure" }),
    )
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("leaves the screen only once the user acknowledges the error alert", async () => {
    // Silenced but not asserted on: the alert this test is about is the thing
    // that proves the rejection landed.
    captureConsoleError()
    mockKycFlowStart.mockRejectedValue(new Error("Network failure"))

    const { result } = renderHook(() => useKycFlow())

    await act(async () => {
      await result.current.startKyc()
    })

    const [okButton] = recordedAlertButtons()
    expect(okButton.text).toBe("OK")
    expect(mockGoBack).not.toHaveBeenCalled()

    act(() => {
      okButton.onPress?.()
    })

    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("alerts with an empty message tail when the rejection is not an Error", async () => {
    const consoleErrorSpy = captureConsoleError()
    // The thrown value says "canceled" on purpose: only an Error may take the
    // goBack path, so this also pins the instanceof guard in front of it.
    mockKycFlowStart.mockRejectedValue("canceled by a non-Error throw")

    const { result } = renderHook(() => useKycFlow())

    await act(async () => {
      await result.current.startKyc()
    })

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "error:",
      "canceled by a non-Error throw",
    )
    // Asserted whole, not with stringContaining: the point is that nothing —
    // "undefined" in particular — follows the blank line. That the alert was
    // raised at all is also what pins the guard, since a non-Error that reached
    // the /canceled/i branch would goBack() and never alert.
    expect(Alert.alert).toHaveBeenCalledWith(
      "Error",
      "Something went wrong\n\n",
      expect.arrayContaining([expect.objectContaining({ text: "OK" })]),
    )
  })

  it("sets loading true during startKyc, false after a successful mutation", async () => {
    let resolvePromise: (value: {
      data: { kycFlowStart: { tokenWeb: string; workflowRunId: string } }
    }) => void
    mockKycFlowStart.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve
        }),
    )

    const { result } = renderHook(() => useKycFlow())

    expect(result.current.loading).toBe(false)

    let startPromise: Promise<void>
    await act(async () => {
      startPromise = result.current.startKyc()
    })

    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolvePromise!({
        data: {
          kycFlowStart: {
            tokenWeb: "t",
            workflowRunId: "w",
          },
        },
      })
      await startPromise!
    })

    expect(result.current.loading).toBe(false)
  })

  // The screen feeds this flag to GaloyPrimaryButton's `loading` prop, and RNE
  // refuses to fire onPress while it is set: a loading flag left true after a
  // failed start bricks the Next button until the screen is remounted.
  it("clears loading after a rejected mutation", async () => {
    const consoleErrorSpy = captureConsoleError()
    let rejectPromise: (reason: Error) => void
    mockKycFlowStart.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectPromise = reject
        }),
    )

    const { result } = renderHook(() => useKycFlow())

    let startPromise: Promise<void>
    await act(async () => {
      startPromise = result.current.startKyc()
    })

    expect(result.current.loading).toBe(true)

    await act(async () => {
      rejectPromise!(new Error("Network failure"))
      await startPromise!
    })

    expect(result.current.loading).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "error:",
      expect.objectContaining({ message: "Network failure" }),
    )
  })
})
