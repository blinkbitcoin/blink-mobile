import { renderHook, act } from "@testing-library/react-native"
import { Network } from "@breeztech/breez-sdk-spark-react-native"

import {
  ExportLogsOutcome,
  useExportSdkLogs,
} from "@app/self-custodial/hooks/use-export-sdk-logs"
import { AccountMode } from "@app/types/account"
import { AccountType } from "@app/types/wallet"

const mockExportSdkLogs = jest.fn()
jest.mock("@app/self-custodial/diagnostics/export-sdk-logs", () => ({
  SDK_LOG_EXPORT_BASENAME: "blink-wallet-logs",
  exportSdkLogs: (...args: unknown[]) => mockExportSdkLogs(...args),
}))

const mockShareTextFile = jest.fn()
jest.mock("@app/utils/share-file", () => ({
  shareTextFile: (...args: unknown[]) => mockShareTextFile(...args),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      support: {
        defaultEmailSubject: ({ bankName }: { bankName: string }) =>
          `${bankName} - Technical Support`,
      },
    },
  }),
}))

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({ appConfig: { galoyInstance: { name: "Blink" } } }),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => Network.Mainnet,
}))

jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ accountMode: AccountMode.Anon }),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    accounts: [
      { id: "a", type: AccountType.SelfCustodial },
      { id: "b", type: AccountType.SelfCustodial },
      { id: "c", type: AccountType.Custodial },
    ],
  }),
}))

const PATH = "/caches/breez-sdk-log-exports/blink-wallet-logs-20261028-0905.txt"

describe("useExportSdkLogs", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExportSdkLogs.mockResolvedValue(PATH)
    mockShareTextFile.mockResolvedValue(true)
  })

  it("builds the export with an identifier-free header and shares it", async () => {
    const { result } = renderHook(() => useExportSdkLogs())

    let outcome: ExportLogsOutcome | undefined
    await act(async () => {
      outcome = await result.current.exportLogs()
    })

    expect(outcome).toBe(ExportLogsOutcome.Shared)
    const [header] = mockExportSdkLogs.mock.calls[0]
    expect(header).toContain("Network: mainnet")
    expect(header).toContain("Account mode: anon")
    expect(header).toContain("Self-custodial wallets on this device: 2")
    expect(mockShareTextFile).toHaveBeenCalledWith(PATH, {
      title: "blink-wallet-logs",
      subject: "Blink - Technical Support",
    })
  })

  it("reports a dismissal", async () => {
    mockShareTextFile.mockResolvedValue(false)
    const { result } = renderHook(() => useExportSdkLogs())

    let outcome: ExportLogsOutcome | undefined
    await act(async () => {
      outcome = await result.current.exportLogs()
    })

    expect(outcome).toBe(ExportLogsOutcome.Dismissed)
  })

  it("does not open the share sheet when there are no logs", async () => {
    mockExportSdkLogs.mockResolvedValue(null)
    const { result } = renderHook(() => useExportSdkLogs())

    let outcome: ExportLogsOutcome | undefined
    await act(async () => {
      outcome = await result.current.exportLogs()
    })

    expect(mockExportSdkLogs).toHaveBeenCalledTimes(1)
    expect(outcome).toBe(ExportLogsOutcome.NoLogs)
    expect(mockShareTextFile).not.toHaveBeenCalled()
  })

  it("spins while building the file and stops before the share sheet settles", async () => {
    let finishBuild: (path: string) => void = () => {}
    mockExportSdkLogs.mockReturnValue(
      new Promise((resolve) => {
        finishBuild = resolve
      }),
    )
    mockShareTextFile.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useExportSdkLogs())

    act(() => {
      result.current.exportLogs()
    })
    expect(result.current.loading).toBe(true)

    await act(async () => {
      finishBuild(PATH)
    })

    expect(mockShareTextFile).toHaveBeenCalledTimes(1)
    expect(result.current.loading).toBe(false)
  })

  it("rejects, with the spinner off, when building the file fails", async () => {
    mockExportSdkLogs.mockRejectedValue(new Error("disk full"))
    const { result } = renderHook(() => useExportSdkLogs())

    await act(async () => {
      await expect(result.current.exportLogs()).rejects.toThrow("disk full")
    })

    expect(result.current.loading).toBe(false)
    expect(mockShareTextFile).not.toHaveBeenCalled()
  })
})
