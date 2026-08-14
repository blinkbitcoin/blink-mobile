import React from "react"
import { act, render } from "@testing-library/react-native"

import { AccountType } from "@app/types/wallet"

const mockSettingsRow = jest.fn((_props: Record<string, unknown>) => null)
jest.mock("@app/screens/settings-screen/row", () => ({
  SettingsRow: mockSettingsRow,
}))

const mockScModal = jest.fn((_props: Record<string, unknown>) => null)
jest.mock(
  "@app/screens/settings-screen/self-custodial/set-lightning-address-modal",
  () => ({
    SetSelfCustodialLightningAddressModal: mockScModal,
  }),
)

const mockCustodialModal = jest.fn((_props: Record<string, unknown>) => null)
jest.mock("@app/components/set-lightning-address-modal", () => ({
  SetLightningAddressModal: mockCustodialModal,
}))

const mockBackupRequiredModal = jest.fn((_props: Record<string, unknown>) => null)
jest.mock("@app/components/backup-required-modal", () => ({
  BackupRequiredModal: mockBackupRequiredModal,
}))

let mockBackupStatus = "completed"
jest.mock("@app/self-custodial/providers/backup-state", () => ({
  BackupStatus: { None: "none", Pending: "pending", Completed: "completed" },
  useBackupState: () => ({ backupState: { status: mockBackupStatus, method: null } }),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

const mockUseAccountRegistry = jest.fn()
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

const mockUseSelfCustodialWallet = jest.fn()
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

const mockCopyToClipboard = jest.fn()
jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: { galoyInstance: { lnAddressHostname: "blink.sv" } },
  }),
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

jest.mock("@app/graphql/is-authed-context", () => ({ useIsAuthed: () => true }))
const mockSettingsScreenQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  useSettingsScreenQuery: () => mockSettingsScreenQuery(),
}))

jest.mock("@rn-vui/themed", () => ({
  useTheme: () => ({ theme: { colors: { primary: "#fc5805" } } }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      SettingsScreen: {
        createAddress: () => "Create address",
      },
      GaloyAddressScreen: { copiedLightningAddressToClipboard: () => "Copied" },
    },
  }),
}))

import { AccountLNAddress } from "@app/screens/settings-screen/settings/account-ln-address"

const lastRowProps = (): Record<string, unknown> =>
  (mockSettingsRow.mock.calls.at(-1)?.[0] ?? {}) as Record<string, unknown>

const SC_ADDRESS = "alice@staging.blink.sv"

describe("AccountLNAddress (self-custodial)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockBackupStatus = "completed"
    mockSettingsScreenQuery.mockReturnValue({ data: undefined, loading: false })
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { id: "sc-1", type: AccountType.SelfCustodial },
      selfCustodialEntries: [],
    })
  })

  it("prompts to create an address and opens the modal when none is registered", () => {
    mockUseSelfCustodialWallet.mockReturnValue({ lightningAddress: null })

    render(<AccountLNAddress />)

    expect(lastRowProps().title).toBe("Create address")
    expect(lastRowProps().rightIcon).toBeUndefined()
    expect(mockScModal.mock.calls.at(-1)?.[0]?.isVisible).toBe(false)

    act(() => (lastRowProps().action as () => void)())

    expect(mockScModal.mock.calls.at(-1)?.[0]?.isVisible).toBe(true)
    expect(mockCopyToClipboard).not.toHaveBeenCalled()
  })

  it("shows the registered address and copies it on press", () => {
    mockUseSelfCustodialWallet.mockReturnValue({ lightningAddress: SC_ADDRESS })

    render(<AccountLNAddress />)

    expect(lastRowProps().title).toBe(SC_ADDRESS)
    expect(lastRowProps().rightIcon).toBeTruthy()

    act(() => (lastRowProps().action as () => void)())

    expect(mockCopyToClipboard).toHaveBeenCalledWith(
      expect.objectContaining({ content: SC_ADDRESS }),
    )
    expect(mockScModal.mock.calls.at(-1)?.[0]?.isVisible).toBe(false)
  })

  it("opens the backup-required modal instead of the create modal when backup is not completed", () => {
    mockBackupStatus = "none"
    mockUseSelfCustodialWallet.mockReturnValue({ lightningAddress: null })

    render(<AccountLNAddress />)

    expect(lastRowProps().title).toBe("Create address")
    expect(mockBackupRequiredModal.mock.calls.at(-1)?.[0]?.isVisible).toBe(false)

    act(() => (lastRowProps().action as () => void)())

    expect(mockBackupRequiredModal.mock.calls.at(-1)?.[0]?.isVisible).toBe(true)
    expect(mockScModal).not.toHaveBeenCalled()
    expect(mockCopyToClipboard).not.toHaveBeenCalled()
  })

  it("also gates address creation while the backup is still pending", () => {
    mockBackupStatus = "pending"
    mockUseSelfCustodialWallet.mockReturnValue({ lightningAddress: null })

    render(<AccountLNAddress />)

    act(() => (lastRowProps().action as () => void)())

    expect(mockBackupRequiredModal.mock.calls.at(-1)?.[0]?.isVisible).toBe(true)
    expect(mockScModal).not.toHaveBeenCalled()
  })

  it("closes the backup-required modal through its onClose prop", () => {
    mockBackupStatus = "none"
    mockUseSelfCustodialWallet.mockReturnValue({ lightningAddress: null })

    render(<AccountLNAddress />)

    act(() => (lastRowProps().action as () => void)())
    expect(mockBackupRequiredModal.mock.calls.at(-1)?.[0]?.isVisible).toBe(true)

    act(() => (mockBackupRequiredModal.mock.calls.at(-1)?.[0]?.onClose as () => void)())

    expect(mockBackupRequiredModal.mock.calls.at(-1)?.[0]?.isVisible).toBe(false)
  })

  it("still copies an existing address on press when backup is not completed", () => {
    mockBackupStatus = "none"
    mockUseSelfCustodialWallet.mockReturnValue({ lightningAddress: SC_ADDRESS })

    render(<AccountLNAddress />)

    act(() => (lastRowProps().action as () => void)())

    expect(mockCopyToClipboard).toHaveBeenCalledWith(
      expect.objectContaining({ content: SC_ADDRESS }),
    )
    expect(mockBackupRequiredModal.mock.calls.at(-1)?.[0]?.isVisible).toBe(false)
  })

  it("shows the persisted address (not the set prompt) while the live address is still resolving", () => {
    mockUseSelfCustodialWallet.mockReturnValue({ lightningAddress: null })
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { id: "sc-1", type: AccountType.SelfCustodial },
      selfCustodialEntries: [{ id: "sc-1", lightningAddress: SC_ADDRESS }],
    })

    render(<AccountLNAddress />)

    expect(lastRowProps().title).toBe(SC_ADDRESS)
    expect(lastRowProps().rightIcon).toBeTruthy()
  })
})

describe("AccountLNAddress (custodial)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // an incomplete backup must never gate the custodial flow
    mockBackupStatus = "none"
    mockUseSelfCustodialWallet.mockReturnValue({ lightningAddress: null })
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { id: "cust-1", type: AccountType.Custodial },
    })
  })

  it("prompts to create an address and opens the custodial modal when there is no username", () => {
    mockSettingsScreenQuery.mockReturnValue({
      data: { me: { username: null } },
      loading: false,
    })

    render(<AccountLNAddress />)

    expect(lastRowProps().title).toBe("Create address")
    expect(lastRowProps().rightIcon).toBeUndefined()
    expect(mockCustodialModal.mock.calls.at(-1)?.[0]?.isVisible).toBe(false)

    act(() => (lastRowProps().action as () => void)())

    expect(mockCustodialModal.mock.calls.at(-1)?.[0]?.isVisible).toBe(true)
    expect(mockBackupRequiredModal).not.toHaveBeenCalled()
    expect(mockCopyToClipboard).not.toHaveBeenCalled()
  })

  it("shows the username@host address and copies it on press", () => {
    mockSettingsScreenQuery.mockReturnValue({
      data: { me: { username: "bob" } },
      loading: false,
    })

    render(<AccountLNAddress />)

    expect(lastRowProps().title).toBe("bob@blink.sv")
    expect(lastRowProps().rightIcon).toBeTruthy()

    act(() => (lastRowProps().action as () => void)())

    expect(mockCopyToClipboard).toHaveBeenCalledWith(
      expect.objectContaining({ content: "bob@blink.sv" }),
    )
  })
})
