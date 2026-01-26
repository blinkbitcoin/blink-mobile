import React from "react"
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native"
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

jest.useFakeTimers()

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
        currencyAmount: "$0.03",
        satAmount: "25 SAT",
        currencyFeeAmount: "$0.00",
        satFeeAmount: "0 SAT",
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

    act(() => {
      jest.advanceTimersByTime(2300)
    })

    expect(screen.getByText(lud09MessageRoute.params.successAction.message)).toBeTruthy()
    expect(screen.getByText(lud09MessageRoute.params.currencyAmount)).toBeTruthy()
    expect(screen.getByText(lud09MessageRoute.params.currencyFeeAmount)).toBeTruthy()
    expect(screen.getByText(lud09MessageRoute.params.paymentType)).toBeTruthy()
    expect(screen.getByText(lud09MessageRoute.params.destination)).toBeTruthy()
    expect(screen.getByText(LL.common.share())).toBeTruthy()
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
        currencyAmount: "$0.03",
        satAmount: "25 SAT",
        currencyFeeAmount: "$0.00",
        satFeeAmount: "0 SAT",
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

    act(() => {
      jest.advanceTimersByTime(2300)
    })

    const button = await waitFor(() =>
      screen.findByTestId(LL.ScanningQRCodeScreen.openLinkTitle()),
    )
    expect(button).toBeTruthy()
    fireEvent.press(button)
    expect(Linking.openURL).toHaveBeenCalledWith(lud09URLRoute.params.successAction.url)

    expect(screen.getByText(lud09URLRoute.params.successAction.url)).toBeTruthy()
    expect(screen.getByText(lud09URLRoute.params.currencyAmount)).toBeTruthy()
    expect(screen.getByText(lud09URLRoute.params.currencyFeeAmount)).toBeTruthy()
    expect(screen.getByText(lud09URLRoute.params.paymentType)).toBeTruthy()
    expect(screen.getByText(lud09URLRoute.params.destination)).toBeTruthy()
    expect(screen.getByText(LL.common.share())).toBeTruthy()
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
        currencyAmount: "$0.03",
        satAmount: "25 SAT",
        currencyFeeAmount: "$0.00",
        satFeeAmount: "0 SAT",
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
    act(() => {
      jest.advanceTimersByTime(2300)
    })
    const button = await waitFor(() =>
      screen.findByTestId(LL.ScanningQRCodeScreen.openLinkTitle()),
    )
    expect(button).toBeTruthy()
    fireEvent.press(button)
    expect(Linking.openURL).toHaveBeenCalledWith(
      lud09URLWithDescRoute.params.successAction.url,
    )

    expect(
      screen.getByText(lud09URLWithDescRoute.params.successAction.description, {
        exact: false,
      }),
    ).toBeTruthy()
    expect(screen.getByText(lud09URLWithDescRoute.params.successAction.url)).toBeTruthy()
    expect(screen.getByText(lud09URLWithDescRoute.params.currencyAmount)).toBeTruthy()
    expect(screen.getByText(lud09URLWithDescRoute.params.currencyFeeAmount)).toBeTruthy()
    expect(screen.getByText(lud09URLWithDescRoute.params.paymentType)).toBeTruthy()
    expect(screen.getByText(lud09URLWithDescRoute.params.destination)).toBeTruthy()
    expect(screen.getByText(LL.common.share())).toBeTruthy()
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
        currencyAmount: "$0.03",
        satAmount: "25 SAT",
        currencyFeeAmount: "$0.00",
        satFeeAmount: "0 SAT",
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
    act(() => {
      jest.advanceTimersByTime(2300)
    })

    expect(
      screen.getByText(
        `${lud10AESRoute.params.successAction.description} ${encryptedMessage}`,
      ),
    ).toBeTruthy()
    expect(screen.getByText(lud10AESRoute.params.currencyAmount)).toBeTruthy()
    expect(screen.getByText(lud10AESRoute.params.currencyFeeAmount)).toBeTruthy()
    expect(screen.getByText(lud10AESRoute.params.paymentType)).toBeTruthy()
    expect(screen.getByText(lud10AESRoute.params.destination)).toBeTruthy()
    expect(screen.getByText(LL.common.share())).toBeTruthy()
  })
})
