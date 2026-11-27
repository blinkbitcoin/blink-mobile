import { renderHook, act } from "@testing-library/react-native"
import { it } from "@jest/globals"
import { Network } from "@breeztech/breez-sdk-spark-react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"

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

/** The active wallet is "a"; each wallet's stored mode is looked up by its id. */
const mockModes: Record<string, AccountMode | null> = {}
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({
    accountMode: mockModes.a ?? null,
    getModeFor: (id: string) => mockModes[id] ?? null,
  }),
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

/** The real per-install id module over an in-memory store, so a mint would show. */
const mockStore = new Map<string, string>()
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStore.set(key, value)
    return Promise.resolve()
  }),
}))

const INSTALL_ID = "3f1c2a9e-7b4d-4e58-9a61-0c2d8e5b7f10"

const PATH = "/caches/breez-sdk-log-exports/blink-wallet-logs-20261028-0905.txt"

describe("useExportSdkLogs", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExportSdkLogs.mockResolvedValue(PATH)
    mockShareTextFile.mockResolvedValue(true)
    mockStore.clear()
    mockModes.a = AccountMode.Anon
    mockModes.b = AccountMode.Anon
  })

  const exportedHeader = async (): Promise<string> => {
    const { result } = renderHook(() => useExportSdkLogs())
    await act(async () => {
      await result.current.exportLogs()
    })
    return mockExportSdkLogs.mock.calls[0][0]
  }

  describe("the analytics id (KB-26)", () => {
    it("is in the header when every wallet on the device is Enhanced", async () => {
      mockStore.set("telemetryInstanceId", INSTALL_ID)
      mockModes.a = AccountMode.Enhanced
      mockModes.b = AccountMode.Enhanced

      const header = await exportedHeader()

      expect(header).toContain("Account mode: enhanced")
      expect(header).toContain(`Analytics ID: ${INSTALL_ID}`)
    })

    it("is said on the disclosure exactly when it is in the file", () => {
      mockModes.a = AccountMode.Enhanced
      mockModes.b = AccountMode.Enhanced
      const { result, rerender } = renderHook(() => useExportSdkLogs())
      expect(result.current.includesAnalyticsId).toBe(true)

      mockModes.b = AccountMode.Anon
      rerender({})

      expect(result.current.includesAnalyticsId).toBe(false)
    })

    it.each([
      ["Incognito", AccountMode.Anon, AccountMode.Anon],
      ["no mode chosen yet", null, null],
      ["Enhanced beside an Incognito wallet", AccountMode.Enhanced, AccountMode.Anon],
      ["Enhanced beside a wallet with no mode", AccountMode.Enhanced, null],
    ])("is absent for %s", async (_label, activeMode, otherMode) => {
      mockStore.set("telemetryInstanceId", INSTALL_ID)
      mockModes.a = activeMode
      mockModes.b = otherMode

      const header = await exportedHeader()

      expect(header).toContain("Network: mainnet")
      expect(header).not.toContain("Analytics ID")
      expect(header).not.toContain(INSTALL_ID)
    })

    it("is never minted by an export", async () => {
      mockModes.a = AccountMode.Enhanced
      mockModes.b = AccountMode.Enhanced

      const header = await exportedHeader()

      expect(header).toContain("Account mode: enhanced")
      expect(header).not.toContain("Analytics ID")
      expect(AsyncStorage.setItem).not.toHaveBeenCalled()
    })
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
