import React from "react"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import {
  Success,
  Queued,
  Pending,
  SuccessAction,
} from "@app/screens/send-bitcoin-screen/send-bitcoin-completed-screen.stories"
import { ContextForScreen } from "./helper"
import { Linking, View } from "react-native"

jest.mock("react-native-in-app-review", () => ({
  isAvailable: () => true,
  RequestInAppReview: jest.fn(),
}))

jest.mock("react-native-view-shot", () => {
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  }
})

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
    expect(within(successTextElement).getByTestId("SUCCESS")).toBeTruthy()
  })

  it("renders the Queued state correctly", async () => {
    render(
      <ContextForScreen>
        <Queued />
      </ContextForScreen>,
    )

    const queuedTextElement = await waitFor(() => screen.findByTestId("Success Text"))
    expect(within(queuedTextElement).getByTestId("QUEUED")).toBeTruthy()
  })

  it("renders the Pending state correctly", async () => {
    render(
      <ContextForScreen>
        <Pending />
      </ContextForScreen>,
    )

    const pendingTextElement = await waitFor(() => screen.findByTestId("Success Text"))
    expect(within(pendingTextElement).getByTestId("PENDING")).toBeTruthy()
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
        formatAmount: "$0.03 (25 SAT)",
        feeDisplayText: "$0.00 (0 SAT)",
        destination: "moises",
        paymentType: "lightning",
        createdAt: 1747691078,
      },
    } as const

    render(
      <ContextForScreen>
        <SuccessAction route={lud09MessageRoute} />
      </ContextForScreen>,
    )

    expect(screen.getByText(lud09MessageRoute.params.successAction.message)).toBeTruthy()
    expect(screen.getByText(lud09MessageRoute.params.formatAmount)).toBeTruthy()
    expect(
      screen.getByText(
        `${lud09MessageRoute.params.feeDisplayText} | ${lud09MessageRoute.params.paymentType}`,
      ),
    ).toBeTruthy()
    expect(screen.getByText(lud09MessageRoute.params.destination)).toBeTruthy()
    expect(screen.getByText(LL.common.share())).toBeTruthy()
    expect(screen.getByText(LL.common.close())).toBeTruthy()
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
        formatAmount: "$0.03 (25 SAT)",
        feeDisplayText: "$0.00 (0 SAT)",
        destination: "moises",
        paymentType: "lightning",
        createdAt: 1747691078,
      },
    } as const

    render(
      <ContextForScreen>
        <SuccessAction route={lud09URLRoute} />
      </ContextForScreen>,
    )

    const button = await waitFor(() =>
      screen.findByTestId(LL.ScanningQRCodeScreen.openLinkTitle()),
    )
    expect(button).toBeTruthy()
    fireEvent.press(button)
    expect(Linking.openURL).toHaveBeenCalledWith(lud09URLRoute.params.successAction.url)

    expect(screen.getByText(lud09URLRoute.params.successAction.url)).toBeTruthy()
    expect(screen.getByText(lud09URLRoute.params.formatAmount)).toBeTruthy()
    expect(
      screen.getByText(
        `${lud09URLRoute.params.feeDisplayText} | ${lud09URLRoute.params.paymentType}`,
      ),
    ).toBeTruthy()
    expect(screen.getByText(lud09URLRoute.params.destination)).toBeTruthy()
    expect(screen.getByText(LL.common.share())).toBeTruthy()
    expect(screen.getByText(LL.common.close())).toBeTruthy()
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
        formatAmount: "$0.03 (25 SAT)",
        feeDisplayText: "$0.00 (0 SAT)",
        destination: "moises",
        paymentType: "lightning",
        createdAt: 1747691078,
      },
    } as const

    render(
      <ContextForScreen>
        <SuccessAction route={lud09URLWithDescRoute} />
      </ContextForScreen>,
    )

    const button = await waitFor(() =>
      screen.findByTestId(LL.ScanningQRCodeScreen.openLinkTitle()),
    )
    expect(button).toBeTruthy()
    fireEvent.press(button)
    expect(Linking.openURL).toHaveBeenCalledWith(
      lud09URLWithDescRoute.params.successAction.url,
    )

    expect(
      screen.getByText(lud09URLWithDescRoute.params.successAction.description),
    ).toBeTruthy()
    expect(screen.getByText(lud09URLWithDescRoute.params.successAction.url)).toBeTruthy()
    expect(screen.getByText(lud09URLWithDescRoute.params.formatAmount)).toBeTruthy()
    expect(
      screen.getByText(
        `${lud09URLWithDescRoute.params.feeDisplayText} | ${lud09URLWithDescRoute.params.paymentType}`,
      ),
    ).toBeTruthy()
    expect(screen.getByText(lud09URLWithDescRoute.params.destination)).toBeTruthy()
    expect(screen.getByText(LL.common.share())).toBeTruthy()
    expect(screen.getByText(LL.common.close())).toBeTruthy()
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
        formatAmount: "$0.03 (25 SAT)",
        feeDisplayText: "$0.00 (0 SAT)",
        destination: "moises",
        paymentType: "lightning",
        createdAt: 1747691078,
      },
    } as const

    render(
      <ContextForScreen>
        <SuccessAction route={lud10AESRoute} />
      </ContextForScreen>,
    )

    expect(
      screen.getByText(
        `${lud10AESRoute.params.successAction.description} ${encryptedMessage}`,
      ),
    ).toBeTruthy()
    expect(screen.getByText(lud10AESRoute.params.formatAmount)).toBeTruthy()
    expect(
      screen.getByText(
        `${lud10AESRoute.params.feeDisplayText} | ${lud10AESRoute.params.paymentType}`,
      ),
    ).toBeTruthy()
    expect(screen.getByText(lud10AESRoute.params.destination)).toBeTruthy()
    expect(screen.getByText(LL.common.share())).toBeTruthy()
    expect(screen.getByText(LL.common.close())).toBeTruthy()
  })
})
