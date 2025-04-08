import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import {
  Success,
  Queued,
  Pending,
  SuccessAction,
} from "@app/screens/send-bitcoin-screen/send-bitcoin-completed-screen.stories"
import { ContextForScreen } from "./helper"
import { Linking } from "react-native"

jest.mock("react-native-in-app-review", () => ({
  isAvailable: () => true,
  RequestInAppReview: jest.fn(),
}))

describe("SendBitcoinCompletedScreen", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    loadLocale("en")
    LL = i18nObject("en")
  })

  it("renders the Success state correctly", async () => {
    render(
      <ContextForScreen>
        <Success />
      </ContextForScreen>,
    )

    const successTextElement = await waitFor(() => screen.findByTestId("Success Text"))
    expect(successTextElement.props.children).toContain(
      "Payment has been sent successfully",
    )
  })

  it("renders the Queued state correctly", async () => {
    render(
      <ContextForScreen>
        <Queued />
      </ContextForScreen>,
    )

    const queuedTextElement = await waitFor(() => screen.findByTestId("Success Text"))
    expect(queuedTextElement.props.children).toEqual(
      expect.stringContaining("Your transaction is queued"),
    )
  })

  it("renders the Pending state correctly", async () => {
    render(
      <ContextForScreen>
        <Pending />
      </ContextForScreen>,
    )

    const pendingTextElement = await waitFor(() => screen.findByTestId("Success Text"))
    expect(pendingTextElement.props.children).toEqual(
      expect.stringContaining("The payment has been sent"),
    )
  })

  it("render successAction - LUD 09 - message", async () => {
    const lud09MessageRoute = {
      key: "sendBitcoinCompleted",
      name: "sendBitcoinCompleted",
      params: {
        status: "SUCCESS",
        successAction: {
          tag: "message",
          description: "",
          url: null,
          message: "Thanks for your support.",
          ciphertext: null,
          iv: null,
          decipher: () => null,
        },
        formatAmount: "%240.00%20(3%20SATS)",
      },
    } as const

    render(
      <ContextForScreen>
        <SuccessAction route={lud09MessageRoute} />
      </ContextForScreen>,
    )

    expect(screen.getByText(lud09MessageRoute.params.successAction.message)).toBeTruthy()
  })

  it("render successAction - LUD 09 - URL", async () => {
    const lud09URLRoute = {
      key: "sendBitcoinCompleted",
      name: "sendBitcoinCompleted",
      params: {
        status: "SUCCESS",
        successAction: {
          tag: "url",
          description: null,
          url: "https://es.blink.sv",
          message: null,
          ciphertext: null,
          iv: null,
          decipher: () => null,
        },
        formatAmount: "%240.00%20(3%20SATS)",
      },
    } as const

    render(
      <ContextForScreen>
        <SuccessAction route={lud09URLRoute} />
      </ContextForScreen>,
    )

    const button = screen.getByText(LL.ScanningQRCodeScreen.openLinkTitle())

    expect(button).toBeTruthy()

    fireEvent.press(button)

    expect(Linking.openURL).toHaveBeenCalledWith(lud09URLRoute.params.successAction.url)
  })

  it("render successAction - LUD 09 - URL with description", async () => {
    const lud09URLWithDescRoute = {
      key: "sendBitcoinCompleted",
      name: "sendBitcoinCompleted",
      params: {
        status: "SUCCESS",
        successAction: {
          tag: "url",
          description: "Example URL + description",
          url: "https://es.blink.sv",
          message: null,
          ciphertext: null,
          iv: null,
          decipher: () => null,
        },
        formatAmount: "%240.00%20(3%20SATS)",
      },
    } as const

    render(
      <ContextForScreen>
        <SuccessAction route={lud09URLWithDescRoute} />
      </ContextForScreen>,
    )

    expect(
      screen.getByText(
        `${lud09URLWithDescRoute.params.successAction.description} ${lud09URLWithDescRoute.params.successAction.url}`,
      ),
    ).toBeTruthy()

    const button = screen.getByText(LL.ScanningQRCodeScreen.openLinkTitle())

    expect(button).toBeTruthy()

    fireEvent.press(button)

    expect(Linking.openURL).toHaveBeenCalledWith(
      lud09URLWithDescRoute.params.successAction.url,
    )
  })

  it("render successAction - LUD 10 - message", async () => {
    const encryptedMessage = "131313"
    const lud10AESRoute = {
      key: "sendBitcoinCompleted",
      name: "sendBitcoinCompleted",
      params: {
        status: "SUCCESS",
        successAction: {
          tag: "aes",
          description: "Here is your redeem code",
          url: null,
          message: null,
          ciphertext: "564u3BEMRefWUV1098gJ5w==",
          iv: "IhkC5ktKB9LG91FvlbN2kg==",
          decipher: () => null,
        },
        preimage: "25004cd52960a3bac983e3f95c432341a7052cef37b9253b0b0b1256d754559b",
        formatAmount: "%240.00%20(3%20SATS)",
      },
    } as const

    render(
      <ContextForScreen>
        <SuccessAction route={lud10AESRoute} />
      </ContextForScreen>,
    )

    expect(screen.getByText(lud10AESRoute.params.successAction.description)).toBeTruthy()
    expect(screen.getByText(encryptedMessage)).toBeTruthy()
  })
})
