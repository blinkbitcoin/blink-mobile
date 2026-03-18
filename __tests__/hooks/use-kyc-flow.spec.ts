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
    Full: "FULL",
    Basic: "BASIC",
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

describe("useKycFlow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
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

  it("builds URL with locale and theme mode", async () => {
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

    const url = mockNavigate.mock.calls[0][1].url as string
    expect(url).toContain("lang=en")
    expect(url).toContain("theme=light")
    expect(url).toContain("token=abc")
    expect(url).toContain("workflow_run_id=wf-1")
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
    mockKycFlowStart.mockRejectedValue(new Error("Request canceled by user"))

    const { result } = renderHook(() => useKycFlow())

    await act(async () => {
      await result.current.startKyc()
    })

    expect(mockGoBack).toHaveBeenCalledTimes(1)
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it("shows Alert on other errors", async () => {
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
  })

  it("sets loading true during startKyc, false after", async () => {
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
})
