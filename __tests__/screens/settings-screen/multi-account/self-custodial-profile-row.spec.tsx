import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { AccountType, DefaultAccountId } from "@app/types/wallet.types"

import { SelfCustodialProfileRow } from "@app/screens/settings-screen/account/multi-account/self-custodial-profile-row"

jest.mock("@rn-vui/themed", () => {
  const colors: Record<string, string> = {
    grey2: "#999",
    grey3: "#bbb",
    grey4: "#ddd",
    grey5: "#f5f5f5",
    white: "#fff",
    black: "#000",
    primary: "#007",
    _green: "#0f0",
  }
  return {
    makeStyles:
      (
        fn: (
          theme: { colors: Record<string, string> },
          params: Record<string, string | undefined>,
        ) => Record<string, object>,
      ) =>
      (params: Record<string, string | undefined> = {}) =>
        fn({ colors }, params),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    useTheme: () => ({ theme: { colors } }),
    ListItem: Object.assign(
      ({ children, ...props }: { children: React.ReactNode }) =>
        React.createElement("ListItem", props, children),
      {
        Content: ({ children }: { children: React.ReactNode }) =>
          React.createElement("ListItemContent", null, children),
        Title: ({ children, ...props }: { children: React.ReactNode }) =>
          React.createElement("Text", props, children),
      },
    ),
    Overlay: ({
      children,
      isVisible,
    }: {
      children: React.ReactNode
      isVisible: boolean
    }) =>
      isVisible
        ? React.createElement("Overlay", { testID: "delete-overlay" }, children)
        : null,
  }
})

const lastConfirmModalProps: {
  isVisible?: boolean
  onClose?: () => void
  onConfirm?: () => void | Promise<void>
} = {}
jest.mock(
  "@app/screens/settings-screen/self-custodial/delete-account-confirm-modal",
  () => {
    const ReactActual = jest.requireActual("react")
    return {
      DeleteAccountConfirmModal: (props: {
        isVisible: boolean
        onClose: () => void
        onConfirm: () => void | Promise<void>
      }) => {
        lastConfirmModalProps.isVisible = props.isVisible
        lastConfirmModalProps.onClose = props.onClose
        lastConfirmModalProps.onConfirm = props.onConfirm
        return props.isVisible
          ? ReactActual.createElement("View", { testID: "delete-modal" })
          : null
      },
    }
  },
)

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

jest.mock("@app/components/atomic/galoy-icon-button/galoy-icon-button", () => {
  const ReactActual = jest.requireActual("react")
  const { TouchableOpacity } = jest.requireActual("react-native")
  return {
    GaloyIconButton: ({
      onPress,
      ...props
    }: {
      onPress?: () => void
      [key: string]: unknown
    }) => ReactActual.createElement(TouchableOpacity, { onPress, ...props }),
  }
})

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

const mockUseAccountRegistry = jest.fn()
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

const mockUseSelfCustodialWallet = jest.fn()
jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

const mockDeleteWallet = jest.fn().mockResolvedValue(undefined)
const mockUseDeleteSelfCustodial = jest.fn()
jest.mock(
  "@app/screens/settings-screen/account/multi-account/hooks/use-delete-self-custodial",
  () => ({
    useDeleteSelfCustodial: () => mockUseDeleteSelfCustodial(),
  }),
)

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AccountTypeSelectionScreen: {
        selfCustodialLabel: () => "Non-custodial",
      },
      ProfileScreen: {
        switchAccount: () => "Switched accounts",
      },
      AccountScreen: {
        pleaseWait: () => "Please wait",
      },
    },
  }),
}))

describe("SelfCustodialProfileRow", () => {
  const setActiveAccountId = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    lastConfirmModalProps.isVisible = undefined
    mockUseSelfCustodialWallet.mockReturnValue({ lightningAddress: null })
    mockUseDeleteSelfCustodial.mockReturnValue({
      state: "idle",
      deleteWallet: mockDeleteWallet,
    })
    mockUseAccountRegistry.mockReturnValue({
      accounts: [
        { id: DefaultAccountId.SelfCustodial, type: AccountType.SelfCustodial },
        { id: DefaultAccountId.Custodial, type: AccountType.Custodial },
      ],
      activeAccount: { id: DefaultAccountId.Custodial, type: AccountType.Custodial },
      setActiveAccountId,
    })
  })

  it("renders nothing when there is no self-custodial account in the registry", () => {
    mockUseAccountRegistry.mockReturnValue({
      accounts: [{ id: DefaultAccountId.Custodial, type: AccountType.Custodial }],
      activeAccount: { id: DefaultAccountId.Custodial, type: AccountType.Custodial },
      setActiveAccountId,
    })

    const { queryByTestId } = render(<SelfCustodialProfileRow />)

    expect(queryByTestId("self-custodial-profile-row")).toBeNull()
  })

  it("switches to the self-custodial account when the row is pressed", () => {
    const { getByTestId } = render(<SelfCustodialProfileRow />)

    fireEvent.press(getByTestId("self-custodial-profile-row"))

    expect(setActiveAccountId).toHaveBeenCalledWith(DefaultAccountId.SelfCustodial)
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", message: "Switched accounts" }),
    )
  })

  it("does not switch when the self-custodial account is already selected", () => {
    mockUseAccountRegistry.mockReturnValue({
      accounts: [{ id: DefaultAccountId.SelfCustodial, type: AccountType.SelfCustodial }],
      activeAccount: {
        id: DefaultAccountId.SelfCustodial,
        type: AccountType.SelfCustodial,
      },
      setActiveAccountId,
    })

    const { getByTestId } = render(<SelfCustodialProfileRow />)
    fireEvent.press(getByTestId("self-custodial-profile-row"))

    expect(setActiveAccountId).not.toHaveBeenCalled()
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("opens the confirm-removal modal when the close icon is pressed", () => {
    const { getByTestId, queryByTestId } = render(<SelfCustodialProfileRow />)

    expect(queryByTestId("delete-modal")).toBeNull()

    fireEvent.press(getByTestId("self-custodial-delete-button"))

    expect(getByTestId("delete-modal")).toBeTruthy()
    expect(mockDeleteWallet).not.toHaveBeenCalled()
  })

  it("calls deleteWallet and closes the modal when the user confirms", async () => {
    const { getByTestId, queryByTestId, rerender } = render(<SelfCustodialProfileRow />)
    fireEvent.press(getByTestId("self-custodial-delete-button"))

    await lastConfirmModalProps.onConfirm?.()
    rerender(<SelfCustodialProfileRow />)

    expect(mockDeleteWallet).toHaveBeenCalledTimes(1)
    expect(queryByTestId("delete-modal")).toBeNull()
  })

  it("does not gate the confirm modal by wallet balance (logout path)", () => {
    mockUseSelfCustodialWallet.mockReturnValue({
      lightningAddress: null,
      wallets: [
        {
          id: "btc-1",
          walletCurrency: "BTC",
          balance: { amount: 9999, currency: "BTC", currencyCode: "BTC" },
          transactions: [],
        },
      ],
    })

    const { getByTestId } = render(<SelfCustodialProfileRow />)
    fireEvent.press(getByTestId("self-custodial-delete-button"))

    expect(getByTestId("delete-modal")).toBeTruthy()
  })

  it("renders the deleting overlay when the delete hook is in deleting state", () => {
    mockUseDeleteSelfCustodial.mockReturnValue({
      state: "deleting",
      deleteWallet: mockDeleteWallet,
    })

    const { getByTestId } = render(<SelfCustodialProfileRow />)

    expect(getByTestId("delete-overlay")).toBeTruthy()
  })

  it("shows the lightning address as the title when available", () => {
    mockUseSelfCustodialWallet.mockReturnValue({
      lightningAddress: "magentamouse1845@breez.tips",
    })

    const { getByText } = render(<SelfCustodialProfileRow />)

    expect(getByText("magentamouse1845@breez.tips")).toBeTruthy()
  })

  it("falls back to the non-custodial label when no lightning address is available", () => {
    const { getByText } = render(<SelfCustodialProfileRow />)

    expect(getByText("Non-custodial")).toBeTruthy()
  })
})
