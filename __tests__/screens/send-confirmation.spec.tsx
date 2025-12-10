import React from "react"
import { TouchableOpacity, Text } from "react-native"
import { Satoshis } from "lnurl-pay"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { DisplayCurrency, toUsdMoneyAmount } from "@app/types/amounts"
import { WalletCurrency } from "@app/graphql/generated"
import * as PaymentDetails from "@app/screens/send-bitcoin-screen/payment-details/intraledger"
import { ConvertMoneyAmount } from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import * as PaymentDetailsLightning from "@app/screens/send-bitcoin-screen/payment-details/lightning"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import {
  Intraledger,
  LightningLnURL,
} from "@app/screens/send-bitcoin-screen/send-bitcoin-confirmation-screen.stories"
import { ContextForScreen } from "./helper"

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useSendBitcoinConfirmationScreenQuery: jest.fn(() => ({
    data: {
      me: {
        id: "mocked-user-id",
        defaultAccount: {
          id: "mocked-account-id",
          wallets: [
            {
              id: "btc-wallet-id",
              balance: 500000,
              walletCurrency: "BTC",
            },
            {
              id: "usd-wallet-id",
              balance: 10000,
              walletCurrency: "USD",
            },
          ],
        },
      },
    },
  })),
}))

const btcSendingWalletDescriptor = {
  currency: WalletCurrency.Usd,
  id: "testwallet",
}

const convertMoneyAmountMock: ConvertMoneyAmount = (amount, currency) => {
  return {
    amount: amount.amount,
    currency,
    currencyCode: currency === DisplayCurrency ? "NGN" : currency,
  }
}

const testAmount = toUsdMoneyAmount(100)

const defaultParams: PaymentDetails.CreateIntraledgerPaymentDetailsParams<WalletCurrency> =
  {
    handle: "test",
    recipientWalletId: "testid",
    convertMoneyAmount: convertMoneyAmountMock,
    sendingWalletDescriptor: btcSendingWalletDescriptor,
    unitOfAccountAmount: testAmount,
  }

const { createIntraledgerPaymentDetails } = PaymentDetails
const paymentDetail = createIntraledgerPaymentDetails(defaultParams)

const route = {
  key: "sendBitcoinConfirmationScreen",
  name: "sendBitcoinConfirmation",
  params: {
    paymentDetail,
  },
} as const

const successActionMessageMock = {
  tag: "message",
  message: "Thank you for your support.",
  description: null,
  url: null,
  ciphertext: null,
  iv: null,
  decipher: () => null,
}

const lnUrlMock = {
  callback: "https://example.com/lnurl/callback",
  metadata: [["text/plain", "Pay to user@example.com"]],
  min: 1000 as Satoshis,
  max: 1000000 as Satoshis,
  fixed: false,
  metadataHash: "",
  identifier: "user@example.com",
  description: "Payment for services",
  image: "https://example.com/image.png",
  commentAllowed: 0,
  rawData: {},
}

const defaultLightningParams: PaymentDetailsLightning.CreateLnurlPaymentDetailsParams<WalletCurrency> =
  {
    lnurl: "lnurl1dp68gurn8ghj7mr...",
    lnurlParams: lnUrlMock,
    paymentRequest: "lnbc1m1psh8d8zpp5qk3z7t...",
    paymentRequestAmount: {
      currency: "BTC",
      currencyCode: "BTC",
      amount: 10000,
    },
    unitOfAccountAmount: {
      currency: "USD",
      amount: 5.0,
      currencyCode: "USD",
    },
    successAction: successActionMessageMock,
    convertMoneyAmount: convertMoneyAmountMock,
    sendingWalletDescriptor: btcSendingWalletDescriptor,
    isMerchant: false,
  }

const saveLnAddressContactMock = jest.fn(({ isMerchant }) => {
  if (isMerchant) {
    return Promise.resolve({ saved: false })
  }
  return Promise.resolve({ saved: true, handle: "user@example.com" })
})
jest.mock("@app/screens/send-bitcoin-screen/use-save-lnaddress-contact", () => ({
  useSaveLnAddressContact: () => saveLnAddressContactMock,
}))

const sendPaymentMock = jest.fn()
jest.mock("@app/screens/send-bitcoin-screen/use-send-payment", () => ({
  useSendPayment: () => ({
    loading: false,
    hasAttemptedSend: false,
    sendPayment: sendPaymentMock,
  }),
}))

jest.mock("@app/components/atomic/galoy-slider-button/galoy-slider-button", () => {
  type Props = { onSwipe: () => void; testID?: string; initialText?: string }

  const MockGaloySliderButton = ({
    onSwipe,
    testID = "slider",
    initialText = "Slide",
  }: Props) => (
    <TouchableOpacity testID={testID} onPress={onSwipe}>
      <Text>{initialText}</Text>
    </TouchableOpacity>
  )

  return { __esModule: true, default: MockGaloySliderButton }
})

describe("SendBitcoinConfirmationScreen", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    LL = i18nObject("en")
  })

  it("Send Screen Confirmation - Intraledger Payment", async () => {
    const { findByLabelText } = render(
      <ContextForScreen>
        <Intraledger route={route} />
      </ContextForScreen>,
    )

    // it seems we need multiple act because the component re-render multiple times
    // probably this could be debug with why-did-you-render
    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )

    const { children } = await findByLabelText("Successful Fee")
    expect(children).toEqual(["₦0 ($0.00)"])
  })

  it("Send Screen Confirmation - Lightning lnurl Payment", async () => {
    const { createLnurlPaymentDetails } = PaymentDetailsLightning
    const paymentDetailLightning = createLnurlPaymentDetails(defaultLightningParams)

    const route = {
      key: "sendBitcoinConfirmationScreen",
      name: "sendBitcoinConfirmation",
      params: {
        paymentDetail: paymentDetailLightning,
      },
    } as const

    const lnurl = "lnurl1dp68gurn8ghj7mr..."

    render(
      <ContextForScreen>
        <LightningLnURL route={route} />
      </ContextForScreen>,
    )

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )

    expect(screen.getByText(lnurl)).toBeTruthy()
    expect(screen.getByText("₦100 ($100.00)")).toBeTruthy()
    expect(screen.getByTestId("slider")).toBeTruthy()
    expect(LL.SendBitcoinConfirmationScreen.slideToConfirm()).toBeTruthy()
  })

  it("Calls saveLnAddressContact when LNURL payment is SUCCESS", async () => {
    const { createLnurlPaymentDetails } = PaymentDetailsLightning
    const paymentDetailLightning = createLnurlPaymentDetails(defaultLightningParams)
    const routeLnurl = {
      key: "sendBitcoinConfirmationScreen",
      name: "sendBitcoinConfirmation",
      params: { paymentDetail: paymentDetailLightning },
    } as const

    sendPaymentMock.mockResolvedValueOnce({
      status: "SUCCESS",
      extraInfo: { preimage: "preimagetest" },
    })

    render(
      <ContextForScreen>
        <LightningLnURL route={routeLnurl} />
      </ContextForScreen>,
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId("slider"))
    })

    expect(sendPaymentMock).toHaveBeenCalledTimes(1)
    expect(saveLnAddressContactMock).toHaveBeenCalledTimes(1)
    expect(saveLnAddressContactMock).toHaveBeenCalledWith({
      paymentType: "lnurl",
      destination: defaultLightningParams.lnurl,
      isMerchant: false,
    })
  })

  it("Call saveLnAddressContact when LNURL payment is PENDING", async () => {
    const { createLnurlPaymentDetails } = PaymentDetailsLightning
    const paymentDetailLightning = createLnurlPaymentDetails(defaultLightningParams)
    const routeLnurl = {
      key: "sendBitcoinConfirmationScreen",
      name: "sendBitcoinConfirmation",
      params: { paymentDetail: paymentDetailLightning },
    } as const

    sendPaymentMock.mockResolvedValueOnce({
      status: "PENDING",
      extraInfo: {},
    })

    render(
      <ContextForScreen>
        <LightningLnURL route={routeLnurl} />
      </ContextForScreen>,
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId("slider"))
    })

    expect(sendPaymentMock).toHaveBeenCalledTimes(1)
    expect(saveLnAddressContactMock).toHaveBeenCalledTimes(1)
    expect(saveLnAddressContactMock).toHaveBeenCalledWith({
      paymentType: "lnurl",
      destination: defaultLightningParams.lnurl,
      isMerchant: false,
    })
  })

  it("Does not call saveLnAddressContact when LNURL payment is to a merchant", async () => {
    const merchantParams = {
      ...defaultLightningParams,
      isMerchant: true,
    }

    const { createLnurlPaymentDetails } = PaymentDetailsLightning
    const paymentDetailMerchant = createLnurlPaymentDetails(merchantParams)
    const routeMerchant = {
      key: "sendBitcoinConfirmationScreen",
      name: "sendBitcoinConfirmation",
      params: { paymentDetail: paymentDetailMerchant },
    } as const

    sendPaymentMock.mockResolvedValueOnce({
      status: "SUCCESS",
      extraInfo: { preimage: "preimagetest" },
    })

    render(
      <ContextForScreen>
        <LightningLnURL route={routeMerchant} />
      </ContextForScreen>,
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId("slider"))
    })

    expect(sendPaymentMock).toHaveBeenCalledTimes(1)
    expect(saveLnAddressContactMock).toHaveBeenCalledTimes(1)
    expect(saveLnAddressContactMock).toHaveBeenCalledWith({
      paymentType: "lnurl",
      destination: merchantParams.lnurl,
      isMerchant: true,
    })
  })
})
