import React from "react"
import { act, render } from "@testing-library/react-native"
import { it } from "@jest/globals"

import { AccountMode } from "@app/types/account"
import { AccountType } from "@app/types/wallet"

type Props = Record<string, unknown>

const mockSettingsRow = jest.fn((_props: Props) => null)
jest.mock("@app/screens/settings-screen/row", () => ({
  SettingsRow: mockSettingsRow,
}))

const mockCustomModal = jest.fn((_props: Props) => null)
jest.mock("@app/components/custom-modal/custom-modal", () => ({
  __esModule: true,
  default: mockCustomModal,
}))

const mockUseAccountRegistry = jest.fn()
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

/** The row must not read the account mode; mocked as Incognito to show it still renders. */
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({
    accountMode: AccountMode.Anon,
    isAnonMode: true,
  }),
}))

const mockExportLogs = jest.fn()
let mockLoading = false
jest.mock("@app/self-custodial/hooks/use-export-sdk-logs", () => ({
  ...jest.requireActual("@app/self-custodial/hooks/use-export-sdk-logs"),
  useExportSdkLogs: () => ({ exportLogs: mockExportLogs, loading: mockLoading }),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const LL = {
  common: { cancel: () => "Cancel" },
  support: {
    downloadLogs: () => "Download logs",
    exportLogsTitle: () => "Share your wallet logs",
    exportLogsBody: () => "This file helps our support team",
    exportLogsConfirm: () => "Share logs",
    noLogsYet: () => "There are no logs to share yet.",
    exportLogsError: () => "Couldn't export your logs.",
  },
}
jest.mock("@app/i18n/i18n-react", () => ({ useI18nContext: () => ({ LL }) }))

import { ExportLogsSetting } from "@app/screens/settings-screen/settings/advanced-export-logs"
import { ExportLogsOutcome } from "@app/self-custodial/hooks/use-export-sdk-logs"

const lastProps = (mock: jest.Mock): Props => (mock.mock.calls.at(-1)?.[0] ?? {}) as Props

const call = async (mock: jest.Mock, prop: string) => {
  await act(async () => {
    await (lastProps(mock)[prop] as () => void | Promise<void>)()
  })
}

const toastMessage = (): string => {
  const { message } = mockToastShow.mock.calls[0][0]
  return (message as (tr: typeof LL) => string)(LL)
}

const selfCustodial = { id: "sc-1", type: AccountType.SelfCustodial }
const custodial = { id: "custodial", type: AccountType.Custodial }

describe("ExportLogsSetting", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLoading = false
    mockUseAccountRegistry.mockReturnValue({ activeAccount: selfCustodial })
    mockExportLogs.mockResolvedValue(ExportLogsOutcome.Shared)
  })

  it("shows only for an active self-custodial account", () => {
    mockUseAccountRegistry.mockReturnValue({ activeAccount: custodial })
    const { rerender } = render(<ExportLogsSetting />)
    expect(mockSettingsRow).not.toHaveBeenCalled()

    mockUseAccountRegistry.mockReturnValue({ activeAccount: selfCustodial })
    rerender(<ExportLogsSetting />)

    expect(lastProps(mockSettingsRow)).toMatchObject({
      title: "Download logs",
      rightIcon: "download",
      spinner: false,
    })
  })

  it("renders in Incognito mode, with no Enhanced-mode gate in front of it", async () => {
    render(<ExportLogsSetting />)

    await call(mockSettingsRow, "action")

    expect(lastProps(mockCustomModal).isVisible).toBe(true)
  })

  it("spins while the export file is being built", () => {
    mockLoading = true
    render(<ExportLogsSetting />)

    expect(lastProps(mockSettingsRow).spinner).toBe(true)
  })

  it("asks first, and exports nothing until the user confirms", async () => {
    render(<ExportLogsSetting />)
    expect(lastProps(mockCustomModal).isVisible).toBe(false)

    await call(mockSettingsRow, "action")

    expect(lastProps(mockCustomModal)).toMatchObject({
      isVisible: true,
      title: "Share your wallet logs",
      primaryButtonTitle: "Share logs",
      secondaryButtonTitle: "Cancel",
    })
    expect(mockExportLogs).not.toHaveBeenCalled()
  })

  it("exports only once the disclosure is off the screen", async () => {
    render(<ExportLogsSetting />)
    await call(mockSettingsRow, "action")

    await call(mockCustomModal, "primaryButtonOnPress")
    expect(lastProps(mockCustomModal).isVisible).toBe(false)
    expect(mockExportLogs).not.toHaveBeenCalled()

    await call(mockCustomModal, "onModalHide")
    expect(mockExportLogs).toHaveBeenCalledTimes(1)

    await call(mockCustomModal, "onModalHide")
    expect(mockExportLogs).toHaveBeenCalledTimes(1)
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it.each(["secondaryButtonOnPress", "toggleModal"])(
    "exports nothing when the disclosure closes through %s",
    async (closer) => {
      render(<ExportLogsSetting />)
      await call(mockSettingsRow, "action")

      await call(mockCustomModal, closer)
      expect(lastProps(mockCustomModal).isVisible).toBe(false)
      await call(mockCustomModal, "onModalHide")

      expect(mockExportLogs).not.toHaveBeenCalled()
    },
  )

  it("says so when there are no logs yet", async () => {
    mockExportLogs.mockResolvedValue(ExportLogsOutcome.NoLogs)
    render(<ExportLogsSetting />)
    await call(mockSettingsRow, "action")
    await call(mockCustomModal, "primaryButtonOnPress")

    await call(mockCustomModal, "onModalHide")

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ type: "warning" }),
    )
    expect(toastMessage()).toBe("There are no logs to share yet.")
  })

  it("stays quiet when the user dismisses the share sheet", async () => {
    mockExportLogs.mockResolvedValue(ExportLogsOutcome.Dismissed)
    render(<ExportLogsSetting />)
    await call(mockSettingsRow, "action")
    await call(mockCustomModal, "primaryButtonOnPress")

    await call(mockCustomModal, "onModalHide")

    expect(mockExportLogs).toHaveBeenCalledTimes(1)
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("reports a failure and tells the user", async () => {
    const error = new Error("disk full")
    mockExportLogs.mockRejectedValue(error)
    render(<ExportLogsSetting />)
    await call(mockSettingsRow, "action")
    await call(mockCustomModal, "primaryButtonOnPress")

    await call(mockCustomModal, "onModalHide")

    expect(mockReportError).toHaveBeenCalledWith("self-custodial-export-logs", error)
    expect(toastMessage()).toBe("Couldn't export your logs.")
  })
})
