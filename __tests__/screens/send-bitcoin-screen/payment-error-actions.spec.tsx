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

const renderActions = (props: React.ComponentProps<typeof PaymentErrorActions>) =>
  render(
    <ContextForScreen>
      <PaymentErrorActions {...props} />
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
    const screen = renderActions({ failedSend: undefined })

    expect(screen.queryByText("View transaction")).toBeNull()
  })

  it("offers nothing for a send with only a preimage to its name", () => {
    const screen = renderActions({ failedSend: { preimage: "pre" } })

    expect(screen.queryByText("View transaction")).toBeNull()
  })

  it("opens the earlier payment that went through", () => {
    const screen = renderActions({ failedSend: { earlierPaymentId: "p-earlier" } })

    fireEvent.press(screen.getByText("View transaction"))

    expect(mockNavigate).toHaveBeenCalledWith("transactionDetail", { txid: "p-earlier" })
  })
})
