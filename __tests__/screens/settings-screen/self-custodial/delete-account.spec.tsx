import React from "react"
import { Network as mockSparkNetwork } from "@breeztech/breez-sdk-spark-react-native"

import { act, fireEvent, render } from "@testing-library/react-native"

import { AccountStatus, AccountType } from "@app/types/wallet"

import { DeleteAccount } from "@app/screens/settings-screen/self-custodial/delete-account"

const TEST_SC_ACCOUNT_ID = "test-self-custodial-uuid"

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ dispatch: jest.fn(), navigate: jest.fn() }),
  CommonActions: { reset: (args: unknown) => ({ type: "reset", payload: args }) },
}))

jest.mock("@rn-vui/themed", () => {
  const colors: Record<string, string> = {
    grey5: "#f5f5f5",
    primary: "#fc5805",
    black: "#000",
    white: "#fff",
    warning: "#F59E0B",
  }
  return {
    makeStyles:
      (
        fn: (
          theme: { colors: Record<string, string> },
          params: Record<string, unknown>,
        ) => Record<string, object>,
      ) =>
      (params: Record<string, unknown> = {}) =>
        fn({ colors }, params),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    Overlay: ({
      isVisible,
      children,
    }: {
      isVisible: boolean
      children: React.ReactNode
    }) =>
      isVisible
        ? React.createElement("View", { testID: "deleting-overlay" }, children)
        : null,
    useTheme: () => ({ theme: { colors, mode: "light" } }),
  }
})

jest.mock("@app/components/card-screen", () => ({
  InfoCard: ({ title }: { title: string }) =>
    React.createElement("Text", { testID: "info-card" }, title),
}))

jest.mock("@app/screens/settings-screen/button", () => ({
  /** Props travel through, so a second button on this screen keeps its own test id rather
   *  than answering to the delete button's. */
  SettingsButton: ({ onPress, title, ...rest }: { onPress: () => void; title: string }) =>
    React.createElement(
      "Pressable",
      { onPress, ...rest },
      React.createElement("Text", {}, title),
    ),
}))

const lastWarningProps: {
  isVisible?: boolean
  onClose?: () => void
  wallets?: ReadonlyArray<{ balance: { amount: number } }>
} = {}
jest.mock(
  "@app/screens/settings-screen/self-custodial/delete-account-has-funds-modal",
  () => ({
    DeleteAccountHasFundsModal: (props: {
      isVisible: boolean
      onClose: () => void
      wallets: ReadonlyArray<{ balance: { amount: number } }>
    }) => {
      lastWarningProps.isVisible = props.isVisible
      lastWarningProps.onClose = props.onClose
      lastWarningProps.wallets = props.wallets
      return props.isVisible
        ? React.createElement("View", { testID: "warning-modal" })
        : null
    },
  }),
)

const lastConfirmProps: {
  isVisible?: boolean
  onClose?: () => void
  onConfirm?: () => void | Promise<void>
} = {}
jest.mock(
  "@app/screens/settings-screen/self-custodial/delete-account-confirm-modal",
  () => ({
    DeleteAccountConfirmModal: (props: {
      isVisible: boolean
      onClose: () => void
      onConfirm: () => void | Promise<void>
    }) => {
      lastConfirmProps.isVisible = props.isVisible
      lastConfirmProps.onClose = props.onClose
      lastConfirmProps.onConfirm = props.onConfirm
      return props.isVisible
        ? React.createElement("View", { testID: "confirm-modal" })
        : null
    },
  }),
)

const mockDeleteWallet = jest.fn().mockResolvedValue(undefined)
jest.mock("@app/self-custodial/hooks/use-delete-account", () => ({
  useDeleteAccount: () => ({
    state: "idle",
    error: null,
    deleteWallet: mockDeleteWallet,
  }),
}))

const mockUseSelfCustodialWallet = jest.fn()
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

let mockNetwork = mockSparkNetwork.Mainnet
jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => mockNetwork,
}))

const mockIsDeletionBlocked = jest.fn()
let mockGuardLoading = false
let mockGuardRecordError = false
const mockRetryRecordRead = jest.fn()
jest.mock("@app/screens/account-migration/hooks/use-migration-deletion-guard", () => ({
  useMigrationDeletionGuard: () => ({
    isDeletionBlocked: mockIsDeletionBlocked,
    isLoading: mockGuardLoading,
    hasRecordError: mockGuardRecordError,
    retryRecordRead: mockRetryRecordRead,
  }),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

const mockFormatMoneyAmount = jest.fn(
  ({ moneyAmount }: { moneyAmount: { amount: number; currencyCode: string } }) =>
    `${moneyAmount.currencyCode} ${moneyAmount.amount}`,
)
jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ formatMoneyAmount: mockFormatMoneyAmount }),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: {
      id: TEST_SC_ACCOUNT_ID,
      type: AccountType.SelfCustodial,
      label: "Spark",
      selected: true,
      status: AccountStatus.RequiresRestore,
    },
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AccountScreen: { pleaseWait: () => "Please wait" },
      common: { tryAgain: () => "Try again" },
      errors: { generic: () => "Something went wrong" },
      SelfCustodialDelete: {
        dangerZoneImportantTitle: () => "Important",
        dangerZoneBulletReinstated: () => "Deleted account cannot be reinstated",
        dangerZoneBulletPermanent: () => "Account deletion is permanent",
        dangerZoneBulletEmpty: () => "Make sure account is empty",
        dangerZoneDeleteButton: () => "Delete account and data",
        dangerZoneMigrationPendingNotice: () =>
          "You can't delete this wallet while the migrated funds are still on their way.",
      },
    },
  }),
}))

const emptyWallet = (id: string, currency: "BTC" | "USD") => ({
  id,
  walletCurrency: currency,
  balance: { amount: 0, currency, currencyCode: currency },
  transactions: [],
})

const fundedWallet = (id: string, currency: "BTC" | "USD", amount: number) => ({
  id,
  walletCurrency: currency,
  balance: { amount, currency, currencyCode: currency },
  transactions: [],
})

describe("DeleteAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockNetwork = mockSparkNetwork.Mainnet
    mockIsDeletionBlocked.mockReturnValue(false)
    mockGuardLoading = false
    mockGuardRecordError = false
    /** clearAllMocks keeps implementations, so a test that returns a refusal would leak
     *  it into the next one. */
    mockDeleteWallet.mockResolvedValue(undefined)
    lastWarningProps.isVisible = undefined
    lastConfirmProps.isVisible = undefined
  })

  it("opens the confirm modal when both wallets are empty", () => {
    mockUseSelfCustodialWallet.mockReturnValue({
      wallets: [emptyWallet("btc", "BTC"), emptyWallet("usd", "USD")],
    })

    const { getByTestId, queryByTestId } = render(<DeleteAccount />)
    fireEvent.press(getByTestId("self-custodial-danger-zone-delete-button"))

    expect(getByTestId("confirm-modal")).toBeTruthy()
    expect(queryByTestId("warning-modal")).toBeNull()
  })

  it("opens the warning modal (not confirm) when the BTC wallet has a balance", () => {
    mockUseSelfCustodialWallet.mockReturnValue({
      wallets: [fundedWallet("btc", "BTC", 21000), emptyWallet("usd", "USD")],
    })

    const { getByTestId, queryByTestId } = render(<DeleteAccount />)
    fireEvent.press(getByTestId("self-custodial-danger-zone-delete-button"))

    expect(getByTestId("warning-modal")).toBeTruthy()
    expect(queryByTestId("confirm-modal")).toBeNull()
    expect(mockDeleteWallet).not.toHaveBeenCalled()
  })

  it("opens the warning modal when only the USD wallet has a balance", () => {
    mockUseSelfCustodialWallet.mockReturnValue({
      wallets: [emptyWallet("btc", "BTC"), fundedWallet("usd", "USD", 500)],
    })

    const { getByTestId, queryByTestId } = render(<DeleteAccount />)
    fireEvent.press(getByTestId("self-custodial-danger-zone-delete-button"))

    expect(getByTestId("warning-modal")).toBeTruthy()
    expect(queryByTestId("confirm-modal")).toBeNull()
  })

  it("warning onClose hides the warning without calling deleteWallet", () => {
    mockUseSelfCustodialWallet.mockReturnValue({
      wallets: [fundedWallet("btc", "BTC", 1), emptyWallet("usd", "USD")],
    })

    const { getByTestId, queryByTestId, rerender } = render(<DeleteAccount />)
    fireEvent.press(getByTestId("self-custodial-danger-zone-delete-button"))
    expect(getByTestId("warning-modal")).toBeTruthy()

    act(() => {
      lastWarningProps.onClose?.()
    })
    rerender(<DeleteAccount />)

    expect(queryByTestId("warning-modal")).toBeNull()
    expect(mockDeleteWallet).not.toHaveBeenCalled()
  })

  it("skips the warning on regtest and opens the confirm modal even with a funded wallet", () => {
    mockNetwork = mockSparkNetwork.Regtest
    mockUseSelfCustodialWallet.mockReturnValue({
      wallets: [fundedWallet("btc", "BTC", 21000), emptyWallet("usd", "USD")],
    })

    const { getByTestId, queryByTestId } = render(<DeleteAccount />)
    fireEvent.press(getByTestId("self-custodial-danger-zone-delete-button"))

    expect(getByTestId("confirm-modal")).toBeTruthy()
    expect(queryByTestId("warning-modal")).toBeNull()
  })

  it("confirm onConfirm calls deleteWallet and closes the modal", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({
      wallets: [emptyWallet("btc", "BTC"), emptyWallet("usd", "USD")],
    })

    const { getByTestId, queryByTestId, rerender } = render(<DeleteAccount />)
    fireEvent.press(getByTestId("self-custodial-danger-zone-delete-button"))

    await act(async () => {
      await lastConfirmProps.onConfirm?.()
    })
    rerender(<DeleteAccount />)

    expect(mockDeleteWallet).toHaveBeenCalledTimes(1)
    expect(mockDeleteWallet).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
    expect(queryByTestId("confirm-modal")).toBeNull()
  })

  describe("while a migration still owes this wallet its funds", () => {
    beforeEach(() => {
      mockIsDeletionBlocked.mockReturnValue(true)
      mockUseSelfCustodialWallet.mockReturnValue({
        wallets: [emptyWallet("btc", "BTC"), emptyWallet("usd", "USD")],
      })
    })

    /** The section exists only to delete, so it says why it cannot rather than vanishing:
     *  a control that disappears with no reason reads as a bug. */
    it("replaces the delete control with the reason it is unavailable", () => {
      const { getByTestId, queryByTestId } = render(<DeleteAccount />)

      expect(queryByTestId("self-custodial-danger-zone-delete-button")).toBeNull()
      expect(getByTestId("self-custodial-danger-zone-blocked-notice")).toBeTruthy()
      expect(
        getByTestId("self-custodial-danger-zone-blocked-notice").props.children,
      ).toBe(
        "You can't delete this wallet while the migrated funds are still on their way.",
      )
    })

    it("asks the guard about the active wallet", () => {
      render(<DeleteAccount />)

      expect(mockIsDeletionBlocked).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
    })

    it("opens no modal and deletes nothing", () => {
      const { queryByTestId } = render(<DeleteAccount />)

      expect(queryByTestId("confirm-modal")).toBeNull()
      expect(queryByTestId("warning-modal")).toBeNull()
      expect(mockDeleteWallet).not.toHaveBeenCalled()
    })

    /** The screen read the record before the mark landed, so it offered the control and
     *  deleteWallet refused from a fresher read: the reason is surfaced rather than the
     *  modal closing over nothing. */
    it("surfaces the reason when deleteWallet refuses from a fresher read", async () => {
      mockIsDeletionBlocked.mockReturnValue(false)
      mockDeleteWallet.mockResolvedValue("blocked")

      const { getByTestId } = render(<DeleteAccount />)
      fireEvent.press(getByTestId("self-custodial-danger-zone-delete-button"))

      await act(async () => {
        await lastConfirmProps.onConfirm?.()
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          message:
            "You can't delete this wallet while the migrated funds are still on their way.",
        }),
      )
    })

    /** Nothing at all while the record is being read: the button would have to be taken
     *  back, and the reason is not yet known to be true. */
    it("offers neither the control nor the reason while the record is being read", () => {
      mockGuardLoading = true
      mockIsDeletionBlocked.mockReturnValue(true)

      const { queryByTestId } = render(<DeleteAccount />)

      expect(queryByTestId("self-custodial-danger-zone-delete-button")).toBeNull()
      expect(queryByTestId("self-custodial-danger-zone-blocked-notice")).toBeNull()
    })

    /** Blocked, but for a reason the blocked copy does not describe. Saying nothing at all
     *  would leave the section with no button, no reason and nothing to act on. */
    it("says what went wrong when the record could not be read", () => {
      mockGuardRecordError = true
      mockIsDeletionBlocked.mockReturnValue(true)

      const { getByTestId, queryByTestId } = render(<DeleteAccount />)

      expect(queryByTestId("self-custodial-danger-zone-delete-button")).toBeNull()
      expect(queryByTestId("self-custodial-danger-zone-blocked-notice")).toBeNull()
      expect(getByTestId("self-custodial-danger-zone-record-error").props.children).toBe(
        "Something went wrong",
      )
    })

    /** The only other way back is an unprompted blur and refocus, which nothing tells the
     *  user to do. */
    it("offers a retry that reads the record again", () => {
      mockGuardRecordError = true
      mockIsDeletionBlocked.mockReturnValue(true)

      const { getByTestId } = render(<DeleteAccount />)
      fireEvent.press(getByTestId("self-custodial-danger-zone-record-retry"))

      expect(mockRetryRecordRead).toHaveBeenCalledTimes(1)
    })

    it("restores the delete control once the block lifts", () => {
      const { getByTestId, queryByTestId, rerender } = render(<DeleteAccount />)
      expect(queryByTestId("self-custodial-danger-zone-delete-button")).toBeNull()

      mockIsDeletionBlocked.mockReturnValue(false)
      rerender(<DeleteAccount />)

      expect(getByTestId("self-custodial-danger-zone-delete-button")).toBeTruthy()
      expect(queryByTestId("self-custodial-danger-zone-blocked-notice")).toBeNull()
    })
  })
})
