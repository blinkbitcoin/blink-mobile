import React from "react"
import { it } from "@jest/globals"
import { Share } from "react-native"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import Clipboard from "@react-native-clipboard/clipboard"
import nfcManager from "react-native-nfc-manager"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { WalletCurrency } from "@app/graphql/generated"
import ReceiveScreen from "@app/screens/receive-bitcoin-screen/receive-screen"

import { ContextForScreen } from "./helper"

const makeQueryResult = (defaultWalletId = "btc-wallet-id") => ({
  loading: false,
  data: {
    globals: {
      __typename: "Globals" as const,
      network: "signet" as const,
      feesInformation: {
        deposit: { minBankFee: "3000", minBankFeeThreshold: "1000000" },
      },
    },
    me: {
      id: "user-id",
      username: "test1",
      defaultAccount: {
        id: "account-id",
        defaultWalletId,
        wallets: [
          {
            id: "btc-wallet-id",
            balance: 88413,
            walletCurrency: WalletCurrency.Btc,
            __typename: "BTCWallet" as const,
          },
          {
            id: "usd-wallet-id",
            balance: 158,
            walletCurrency: WalletCurrency.Usd,
            __typename: "UsdWallet" as const,
          },
        ],
        __typename: "ConsumerAccount" as const,
      },
      __typename: "User" as const,
    },
  },
})

const paymentRequestQueryMock = jest.fn(() => makeQueryResult())

const lnNoAmountInvoiceCreateMock = jest.fn(() =>
  Promise.resolve({
    data: {
      lnNoAmountInvoiceCreate: {
        errors: [],
        invoice: {
          paymentRequest:
            "lntbs1pjt95g2pp5c2nwtj3zpl08suelj8u26tuhnkhkqzd9pcsc7mu9lgpkh3th9k5sdqqcqzpuxqzfvsp5test",
          paymentHash: "c2a6e5ca220fde78733f91f8ad2f979daf6009a50e218f6f85fa036bc5772da9",
          __typename: "LnNoAmountInvoice" as const,
        },
        __typename: "LnNoAmountInvoicePayload" as const,
      },
    },
  }),
)

const onChainAddressCurrentMock = jest.fn(() =>
  Promise.resolve({
    data: {
      onChainAddressCurrent: {
        errors: [],
        address: "tb1qstk6xund50xqcrnz7vsly2rke6xpw05pc7lmz5",
      },
    },
  }),
)

jest.mock("@app/graphql/generated", () => {
  const actual = jest.requireActual("@app/graphql/generated")
  return {
    ...actual,
    usePaymentRequestQuery: () => paymentRequestQueryMock(),
    useRealtimePriceQuery: () => ({ data: null }),
    useLnNoAmountInvoiceCreateMutation: () => [lnNoAmountInvoiceCreateMock],
    useLnInvoiceCreateMutation: () => [jest.fn()],
    useLnUsdInvoiceCreateMutation: () => [jest.fn()],
    useOnChainAddressCurrentMutation: () => [onChainAddressCurrentMock],
    useMyLnUpdatesSubscription: () => ({ data: null }),
  }
})

const priceConversionMock = jest.fn(() => ({
  convertMoneyAmount: (
    moneyAmount: { amount: number; currency: string },
    toCurrency: string,
  ) => ({
    amount: moneyAmount.amount,
    currency: toCurrency,
    currencyCode: toCurrency,
  }),
}))

jest.mock("@app/hooks", () => {
  const actual = jest.requireActual("@app/hooks")
  return {
    ...actual,
    usePriceConversion: () => priceConversionMock(),
    useAppConfig: () => ({
      appConfig: {
        galoyInstance: {
          lnAddressHostname: "blink.sv",
          name: "Blink",
          posUrl: "https://pay.blink.sv",
        },
      },
    }),
  }
})

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
      `$${moneyAmount.amount}`,
    getSecondaryAmountIfCurrencyIsDifferent: () => null,
    zeroDisplayAmount: { amount: 0, currency: "DisplayCurrency", currencyCode: "USD" },
    currencyInfo: {
      USD: {
        symbol: "$",
        minorUnitToMajorUnitOffset: 2,
        showFractionDigits: true,
        currencyCode: "USD",
      },
      BTC: {
        symbol: "",
        minorUnitToMajorUnitOffset: 0,
        showFractionDigits: false,
        currencyCode: "SAT",
      },
      DisplayCurrency: {
        symbol: "$",
        minorUnitToMajorUnitOffset: 2,
        showFractionDigits: true,
        currencyCode: "USD",
      },
    },
  }),
}))

jest.mock("@react-native-clipboard/clipboard", () => ({
  setString: jest.fn(),
  getString: jest.fn(() => Promise.resolve("")),
}))

jest.mock("@app/components/upgrade-account-modal", () => ({
  TrialAccountLimitsModal: () => null,
}))

jest.mock("react-native-nfc-manager", () => ({
  __esModule: true,
  default: {
    isSupported: jest.fn().mockResolvedValue(false),
    start: jest.fn(),
    stop: jest.fn(),
  },
}))

jest.mock("react-native-modal", () => {
  const MockedModal = ({
    isVisible,
    children,
  }: {
    isVisible: boolean
    children: React.ReactNode
  }) => {
    if (!isVisible) return null
    return <>{children}</>
  }
  return MockedModal
})

jest.mock("react-native-haptic-feedback", () => ({
  trigger: jest.fn(),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: jest.fn(),
}))

jest.mock("react-native-reanimated", () => {
  const { View: RNView, Animated: RNAnimated } = jest.requireActual("react-native")
  return {
    __esModule: true,
    default: {
      View: RNView,
      createAnimatedComponent: (component: React.ComponentType) =>
        RNAnimated.createAnimatedComponent(component),
    },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    withTiming: (value: number) => value,
    cancelAnimation: jest.fn(),
    interpolate: jest.fn(() => 0),
    Easing: { bezier: () => jest.fn() },
    runOnJS: (fn: () => void) => fn,
  }
})

jest.mock("react-native-reanimated-carousel", () => {
  const ReactMock = jest.requireActual("react")
  const { View: RNView, Pressable: RNPressable } = jest.requireActual("react-native")

  type CarouselRenderInfo = {
    index: number
    animationValue: { value: number }
  }

  type CarouselProps = {
    data: number[]
    renderItem: (info: CarouselRenderInfo) => React.ReactElement
    onSnapToItem: (index: number) => void
  }

  const Carousel = ReactMock.forwardRef(
    (props: CarouselProps, _ref: React.Ref<never>) => (
      <RNView testID="carousel">
        {props.data.map((_: number, index: number) => (
          <RNPressable
            key={index}
            testID={`carousel-page-${index}`}
            onPress={() => props.onSnapToItem(index)}
          >
            {props.renderItem({ index, animationValue: { value: 0 } })}
          </RNPressable>
        ))}
      </RNView>
    ),
  )
  Carousel.displayName = "MockCarousel"

  return { __esModule: true, default: Carousel }
})

jest.mock("@app/screens/receive-bitcoin-screen/qr-view", () => {
  const { View: RNView, Text: RNText } = jest.requireActual("react-native")
  return {
    QRView: ({ type, loading }: { type: string; loading: boolean }) => (
      <RNView testID={`qr-view-${type}`}>
        <RNText>{loading ? "Loading" : `QR-${type}`}</RNText>
      </RNView>
    ),
  }
})

const flushAsync = () =>
  act(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      }),
  )

describe("ReceiveScreen", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeAll(() => {
    loadLocale("en")
  })

  beforeEach(() => {
    jest.clearAllMocks()
    LL = i18nObject("en")
  })

  describe("UI structure", () => {
    it.each([
      { name: "receive-screen container", testId: "receive-screen" },
      { name: "carousel", testId: "carousel" },
      { name: "page 0 (Lightning/PayCode)", testId: "carousel-page-0" },
      { name: "page 1 (OnChain)", testId: "carousel-page-1" },
      { name: "onchain QR on page 1", testId: "qr-view-OnChain" },
      { name: "payment identifier", testId: "readable-payment-request" },
    ])("renders $name", async ({ testId }) => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await flushAsync()
      await flushAsync()

      expect(screen.getByTestId(testId)).toBeTruthy()
    })

    it("renders copy and share action buttons", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await flushAsync()
      await flushAsync()

      expect(screen.getByText(LL.ReceiveScreen.copyInvoice())).toBeTruthy()
      expect(screen.getByText(LL.ReceiveScreen.shareInvoice())).toBeTruthy()
    })
  })

  describe("PayCode flow (username present)", () => {
    it("renders PayCode QR on page 0", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("qr-view-PayCode")).toBeTruthy()
        expect(screen.getByText("QR-PayCode")).toBeTruthy()
      })
    })

    it("shows lightning address as payment identifier", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await waitFor(() => {
        expect(screen.getByText("test1@blink.sv")).toBeTruthy()
      })
    })

    it("copies paycode to clipboard when pressing copy button", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await waitFor(() => {
        expect(screen.getByText("test1@blink.sv")).toBeTruthy()
      })

      fireEvent.press(screen.getByText(LL.ReceiveScreen.copyInvoice()))

      expect(Clipboard.setString).toHaveBeenCalledTimes(1)
    })

    it("copies paycode when tapping payment identifier", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await waitFor(() => {
        expect(screen.getByText("test1@blink.sv")).toBeTruthy()
      })

      fireEvent.press(screen.getByText("test1@blink.sv"))

      expect(Clipboard.setString).toHaveBeenCalledTimes(1)
    })

    it("shares paycode when pressing share button", async () => {
      const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({
        action: Share.sharedAction,
      })

      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await waitFor(() => {
        expect(screen.getByText("test1@blink.sv")).toBeTruthy()
      })

      fireEvent.press(screen.getByText(LL.ReceiveScreen.shareInvoice()))

      await flushAsync()

      expect(shareSpy).toHaveBeenCalledTimes(1)

      shareSpy.mockRestore()
    })
  })

  describe("OnChain flow (page 1)", () => {
    it("fetches onchain address on mount", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await waitFor(() => {
        expect(onChainAddressCurrentMock).toHaveBeenCalled()
      })
    })

    it("renders OnChain QR on page 1", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await flushAsync()
      await flushAsync()

      expect(screen.getByTestId("qr-view-OnChain")).toBeTruthy()
      expect(screen.getByText("QR-OnChain")).toBeTruthy()
    })

    it("shows truncated onchain address after swiping to page 1", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await flushAsync()
      await flushAsync()

      fireEvent.press(screen.getByTestId("carousel-page-1"))

      await waitFor(() => {
        expect(screen.getByText("tb1qstk6xu...w05pc7lmz5")).toBeTruthy()
      })
    })

    it("copies onchain address when pressing copy on page 1", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await flushAsync()
      await flushAsync()

      fireEvent.press(screen.getByTestId("carousel-page-1"))

      await flushAsync()
      await flushAsync()

      fireEvent.press(screen.getByText(LL.ReceiveScreen.copyInvoice()))

      expect(Clipboard.setString).toHaveBeenCalledWith(
        "tb1qstk6xund50xqcrnz7vsly2rke6xpw05pc7lmz5",
      )
    })

    it("shares onchain address when pressing share on page 1", async () => {
      const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({
        action: Share.sharedAction,
      })

      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await flushAsync()
      await flushAsync()

      fireEvent.press(screen.getByTestId("carousel-page-1"))

      await flushAsync()
      await flushAsync()

      fireEvent.press(screen.getByText(LL.ReceiveScreen.shareInvoice()))

      await flushAsync()

      expect(shareSpy).toHaveBeenCalledWith({
        message: "tb1qstk6xund50xqcrnz7vsly2rke6xpw05pc7lmz5",
      })

      shareSpy.mockRestore()
    })
  })

  describe("Note input", () => {
    it("is editable on onchain page", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await flushAsync()
      await flushAsync()

      fireEvent.press(screen.getByTestId("carousel-page-1"))

      await flushAsync()
      await flushAsync()

      expect(screen.getByTestId("add-note").props.editable).toBe(true)
    })
  })

  describe("Wallet toggle (BTC default)", () => {
    it("switches from PayCode to Lightning when toggling wallet", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await waitFor(() => {
        expect(screen.getByText("QR-PayCode")).toBeTruthy()
      })

      fireEvent.press(screen.getByLabelText("Toggle wallet"))
      await flushAsync()
      await flushAsync()

      await waitFor(() => {
        expect(screen.getByTestId("qr-view-Lightning")).toBeTruthy()
      })
    })

    it("reverts to PayCode when toggling back to BTC with no content", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await waitFor(() => {
        expect(screen.getByText("QR-PayCode")).toBeTruthy()
      })

      fireEvent.press(screen.getByLabelText("Toggle wallet"))
      await flushAsync()
      await flushAsync()

      await waitFor(() => {
        expect(screen.getByTestId("qr-view-Lightning")).toBeTruthy()
      })

      fireEvent.press(screen.getByLabelText("Toggle wallet"))
      await flushAsync()
      await flushAsync()

      await waitFor(() => {
        expect(screen.getByTestId("qr-view-PayCode")).toBeTruthy()
      })
    })
  })

  describe("USD default account", () => {
    beforeEach(() => {
      paymentRequestQueryMock.mockReturnValue(makeQueryResult("usd-wallet-id"))
    })

    afterEach(() => {
      paymentRequestQueryMock.mockReturnValue(makeQueryResult())
    })

    it("starts on Lightning instead of PayCode", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await flushAsync()
      await flushAsync()

      await waitFor(() => {
        expect(screen.getByTestId("qr-view-Lightning")).toBeTruthy()
      })

      expect(screen.queryByTestId("qr-view-PayCode")).toBeNull()
    })

    it("reverts to PayCode when toggling to BTC with no content", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await flushAsync()
      await flushAsync()

      await waitFor(() => {
        expect(screen.getByTestId("qr-view-Lightning")).toBeTruthy()
      })

      fireEvent.press(screen.getByLabelText("Toggle wallet"))
      await flushAsync()
      await flushAsync()

      await waitFor(() => {
        expect(screen.getByTestId("qr-view-PayCode")).toBeTruthy()
      })
    })
  })

  describe("NFC without amount", () => {
    beforeEach(() => {
      jest.mocked(nfcManager.isSupported).mockResolvedValue(true)
    })

    afterEach(() => {
      jest.mocked(nfcManager.isSupported).mockResolvedValue(false)
    })

    it("opens amount input when pressing NFC icon on PayCode", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await waitFor(() => {
        expect(screen.getByText("QR-PayCode")).toBeTruthy()
      })

      await flushAsync()
      await flushAsync()

      fireEvent.press(screen.getByTestId("nfc-icon"))
      await flushAsync()

      await waitFor(() => {
        expect(screen.getByText(LL.AmountInputScreen.enterAmount())).toBeTruthy()
      })
    })

    it("opens amount input when pressing NFC icon on Lightning invoice", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await waitFor(() => {
        expect(screen.getByText("QR-PayCode")).toBeTruthy()
      })

      fireEvent.press(screen.getByLabelText("Toggle wallet"))
      await flushAsync()
      await flushAsync()

      await waitFor(() => {
        expect(screen.getByTestId("qr-view-Lightning")).toBeTruthy()
      })

      await flushAsync()
      await flushAsync()

      fireEvent.press(screen.getByTestId("nfc-icon"))
      await flushAsync()

      await waitFor(() => {
        expect(screen.getByText(LL.AmountInputScreen.enterAmount())).toBeTruthy()
      })
    })
  })

  describe("data hooks integration", () => {
    it("calls paymentRequestQuery on mount", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await flushAsync()

      expect(paymentRequestQueryMock).toHaveBeenCalled()
    })

    it("calls priceConversion hook on mount", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await flushAsync()

      expect(priceConversionMock).toHaveBeenCalled()
    })
  })
})
