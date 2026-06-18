import React from "react"
import { act, fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { StableBalanceConfirmModal } from "@app/screens/stable-balance-settings-screen/stable-balance-confirm-modal"

type ModalProps = React.ComponentProps<typeof StableBalanceConfirmModal>

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      StableBalance: {
        toggleModal: {
          activateTitle: () => "Activate Stable Balance",
          activateBody: () => "Your BTC will be converted to USDB.",
          activateConfirm: () => "Activate",
          deactivateTitle: () => "Deactivate Stable Balance",
          deactivateBody: () => "Your USDB will be converted back to BTC.",
          deactivateConfirm: () => "Deactivate",
          cancel: () => "Cancel",
        },
      },
      ConversionConfirmationScreen: {
        feeLabel: () => "Conversion fee",
        feeError: () => "Couldn't fetch the conversion fee",
      },
      common: {
        cancel: () => "Cancel",
      },
    },
  }),
}))

const onConfirm = jest.fn()
const onCancel = jest.fn()

const baseProps: ModalProps = {
  isVisible: true,
  isActivating: true,
  feeText: "$0.05",
  isLoading: false,
  hasError: false,
  showFeeRow: true,
  isSubmitting: false,
  onConfirm,
  onCancel,
}

const renderModal = (overrides: Partial<ModalProps> = {}) =>
  render(
    <ThemeProvider theme={theme}>
      <StableBalanceConfirmModal {...baseProps} {...overrides} />
    </ThemeProvider>,
  )

// react-native-modal animates its mount/unmount via RN Animated timers; let those
// settle inside act() so their trailing setState doesn't fire outside act between tests.
const settleModalAnimations = async (): Promise<void> => {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 400)
    })
  })
}

describe("StableBalanceConfirmModal", () => {
  beforeEach(() => {
    onConfirm.mockReset()
    onCancel.mockReset()
  })

  it("renders the activation title, body and fee", async () => {
    const { getByText } = renderModal()

    expect(getByText("Activate Stable Balance")).toBeTruthy()
    expect(getByText("Your BTC will be converted to USDB.")).toBeTruthy()
    expect(getByText("$0.05")).toBeTruthy()

    await settleModalAnimations()
  })

  it("renders the deactivation title and warning when provided", async () => {
    const { getByText } = renderModal({
      isActivating: false,
      deactivationWarning: "You still have 5.00 USD.",
    })

    expect(getByText("Deactivate Stable Balance")).toBeTruthy()
    expect(getByText("You still have 5.00 USD.")).toBeTruthy()

    await settleModalAnimations()
  })

  it("invokes onConfirm when the primary button is pressed", async () => {
    const { getByText } = renderModal()

    fireEvent.press(getByText("Activate"))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    await settleModalAnimations()
  })

  it("does not invoke onConfirm when the fee preview has an error", async () => {
    const { getByText } = renderModal({ hasError: true })

    fireEvent.press(getByText("Activate"))
    expect(onConfirm).not.toHaveBeenCalled()

    await settleModalAnimations()
  })

  it("does not invoke onConfirm while loading", async () => {
    const { getByText } = renderModal({ isLoading: true })

    fireEvent.press(getByText("Activate"))
    expect(onConfirm).not.toHaveBeenCalled()

    await settleModalAnimations()
  })

  it("invokes onCancel when the secondary button is pressed", async () => {
    const { getByText } = renderModal()

    fireEvent.press(getByText("Cancel"))
    expect(onCancel).toHaveBeenCalledTimes(1)

    await settleModalAnimations()
  })

  it("hides the fee row when showFeeRow is false", async () => {
    const { queryByText } = renderModal({ showFeeRow: false })

    expect(queryByText("$0.05")).toBeNull()

    await settleModalAnimations()
  })
})
