import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { PaymentErrorActions } from "@app/screens/send-bitcoin-screen/payment-error-actions"

import { ContextForScreen } from "../helper"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actual = jest.requireActual("@react-navigation/native")
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate }),
  }
})

const renderActions = (
  props: Omit<React.ComponentProps<typeof PaymentErrorActions>, "canSendAnyway"> & {
    canSendAnyway?: boolean
  },
) =>
  render(
    <ContextForScreen>
      <PaymentErrorActions canSendAnyway={true} {...props} />
    </ContextForScreen>,
  )

describe("PaymentErrorActions", () => {
  beforeAll(() => {
    loadLocale("en")
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("offers nothing for a send that said nothing about itself", () => {
    const screen = renderActions({ failedSend: undefined, onSendAnyway: jest.fn() })

    expect(screen.queryByText("View transaction")).toBeNull()
    expect(screen.queryByText("I checked my history, send anyway")).toBeNull()
  })

  it("offers nothing for a send with only a preimage to its name", () => {
    const screen = renderActions({
      failedSend: { preimage: "pre" },
      onSendAnyway: jest.fn(),
    })

    expect(screen.queryByText("View transaction")).toBeNull()
  })

  it("opens the earlier payment that went through", () => {
    const screen = renderActions({
      failedSend: { earlierPaymentId: "p-earlier" },
      onSendAnyway: jest.fn(),
    })

    fireEvent.press(screen.getByText("View transaction"))

    expect(mockNavigate).toHaveBeenCalledWith("transactionDetail", { txid: "p-earlier" })
    expect(screen.queryByText("I checked my history, send anyway")).toBeNull()
  })

  it("opens the transaction history after an outcome that could not be checked", () => {
    const screen = renderActions({
      failedSend: { checkHistory: true, sendAnyway: jest.fn() },
      onSendAnyway: jest.fn(),
    })

    fireEvent.press(screen.getByText("Transaction History"))

    expect(mockNavigate).toHaveBeenCalledWith("transactionHistory")
  })

  it("releases the destination and clears the error when the sender sends anyway", () => {
    const sendAnyway = jest.fn()
    const onSendAnyway = jest.fn()
    const screen = renderActions({
      failedSend: { checkHistory: true, sendAnyway },
      onSendAnyway,
    })

    fireEvent.press(screen.getByText("I checked my history, send anyway"))

    expect(sendAnyway).toHaveBeenCalledTimes(1)
    expect(onSendAnyway).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("offers no send anyway while the screen could not send, only the history", () => {
    const screen = renderActions({
      failedSend: { checkHistory: true, sendAnyway: jest.fn() },
      canSendAnyway: false,
      onSendAnyway: jest.fn(),
    })

    expect(screen.getByText("Transaction History")).toBeTruthy()
    expect(screen.queryByText("I checked my history, send anyway")).toBeNull()
  })

  it("points at the history alone when there is no way past the outcome yet", () => {
    const onSendAnyway = jest.fn()
    const screen = renderActions({ failedSend: { checkHistory: true }, onSendAnyway })

    fireEvent.press(screen.getByText("Transaction History"))

    expect(mockNavigate).toHaveBeenCalledWith("transactionHistory")
    expect(screen.queryByText("I checked my history, send anyway")).toBeNull()
    expect(onSendAnyway).not.toHaveBeenCalled()
  })
})
