import React from "react"
import { Satoshis, type LnUrlPayServiceResponse } from "lnurl-pay"

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { WalletCurrency } from "@app/graphql/generated"
import SendBitcoinDetailsScreen from "@app/screens/send-bitcoin-screen/send-bitcoin-details-screen"
import {
  ConvertMoneyAmount,
  PaymentDetail,
} from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import {
  CreatePaymentDetailParams,
  DestinationDirection,
  PaymentDestination,
  ResolvedIntraledgerPaymentDestination,
} from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import {
  createIntraledgerPaymentDetails,
  createNoAmountOnchainPaymentDetails,
} from "@app/screens/send-bitcoin-screen/payment-details"
import { ZeroBtcMoneyAmount } from "@app/types/amounts"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { ContextForScreen } from "./helper"

/** react-native-modal grabs an InteractionManager handle on open, which RN warns is deprecated. */
jest.mock("react-native-modal", () => {
  const MockModal = ({
    children,
    isVisible,
  }: {
    children: React.ReactNode
    isVisible: boolean
  }) => (isVisible ? React.createElement("View", { testID: "modal" }, children) : null)
  MockModal.displayName = "MockModal"
  return MockModal
})

const mockRequestInvoice = jest.fn()
const mockRequestInvoiceWithServiceParams = jest.fn()
jest.mock("lnurl-pay", () => ({
  ...jest.requireActual("lnurl-pay"),
  requestInvoice: (...args: unknown[]) => mockRequestInvoice(...args),
  requestInvoiceWithServiceParams: (...args: unknown[]) =>
    mockRequestInvoiceWithServiceParams(...args),
}))

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    setOptions: jest.fn(),
  }),
}))

jest.mock("@app/store/persistent-state", () => ({
  ...jest.requireActual("@app/store/persistent-state"),
  usePersistentStateContext: () => ({
    persistentState: {
      schemaVersion: 12,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "",
    },
    updateState: jest.fn(),
    resetState: jest.fn(),
  }),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  // Only the consumer hook is stubbed: the shared screen wrapper builds its
  // settled registry from this module's context and value builder, so replacing
  // the module wholesale would leave it without either.
  ...jest.requireActual("@app/hooks/use-account-registry"),
  useAccountRegistry: () => ({
    accounts: [],
    activeAccount: undefined,
    selfCustodialEntries: [],
    setActiveAccountId: jest.fn(),
    reloadSelfCustodialAccounts: jest.fn(),
  }),
}))

jest.mock("@app/hooks/use-effective-display-currency", () => ({
  useEffectiveDisplayCurrency: () => ({
    displayCurrency: "NGN",
    setDisplayCurrency: jest.fn(),
    loading: false,
  }),
}))

/**
 * The account query behind this screen answers without a balance, which leaves the amount
 * rules unreachable. Balances are stood up here instead, far enough above anything typed
 * that the amount input never clamps and only the daily limit can turn an amount down.
 */
jest.mock("@app/screens/send-bitcoin-screen/hooks/use-send-wallets", () => {
  const btcWallet = {
    id: "f79792e3-282b-45d4-85d5-7486d020def5",
    balance: 100_000_000,
    walletCurrency: "BTC",
  }
  const usdWallet = {
    id: "f091c102-6277-4cc6-8d81-87ebf6aaad1b",
    balance: 1_000_000,
    walletCurrency: "USD",
  }

  return {
    ...jest.requireActual("@app/screens/send-bitcoin-screen/hooks/use-send-wallets"),
    useSendWallets: () => ({
      wallets: [btcWallet, usdWallet],
      defaultWallet: btcWallet,
      btcWallet,
      usdWallet,
      network: "mainnet",
      loading: false,
      isSelfCustodial: false,
    }),
  }
})

/**
 * The withdrawal allowance, in cents. It starts where the shared account mock leaves it, so
 * only a test that lowers it on purpose has an amount turned down for being over the limit.
 */
const mockWithdrawalAllowance = { remaining: 100_000_000 }

/**
 * The tier quote, answered per test rather than left to fall off the end of the mocked
 * responses. Held as one stable function because Apollo hands back a stable execute across
 * renders, and a fresh identity per render would re-arm the hook's effect forever.
 */
const mockQuoteFees = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useSendBitcoinWithdrawalLimitsQuery: () => ({
    data: {
      me: {
        defaultAccount: {
          limits: {
            withdrawal: [
              {
                totalLimit: 100_000_000,
                remainingLimit: mockWithdrawalAllowance.remaining,
                interval: 86_400,
              },
            ],
          },
        },
      },
    },
  }),
  useOnChainTxFeeBySpeedLazyQuery: () => [mockQuoteFees],
  useOnChainUsdTxFeeBySpeedLazyQuery: () => [mockQuoteFees],
  useOnChainUsdTxFeeAsBtcDenominatedBySpeedLazyQuery: () => [mockQuoteFees],
}))

const quotedFees = {
  data: { fast: { amount: 900 }, medium: { amount: 600 }, slow: { amount: 300 } },
}
const failedQuote = { data: undefined }

beforeEach(() => {
  mockQuoteFees.mockResolvedValue(quotedFees)
})

afterEach(() => {
  mockWithdrawalAllowance.remaining = 100_000_000
})

jest.mock("@react-native-firebase/app-check", () => {
  return () => ({
    initializeAppCheck: jest.fn(),
    getToken: jest.fn(),
    newReactNativeFirebaseAppCheckProvider: () => ({
      configure: jest.fn(),
    }),
  })
})

jest.mock("react-native-config", () => {
  return {
    APP_CHECK_ANDROID_DEBUG_TOKEN: "token",
    APP_CHECK_IOS_DEBUG_TOKEN: "token",
  }
})

const flushAsync = () =>
  act(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      }),
  )

const intraledgerWalletId = "f79792e3-282b-45d4-85d5-7486d020def5"
const intraledgerHandle = "test"

const intraledgerValidDestination: ResolvedIntraledgerPaymentDestination = {
  valid: true,
  walletId: intraledgerWalletId,
  paymentType: PaymentType.Intraledger,
  handle: intraledgerHandle,
}

const createIntraledgerPaymentDetail = <T extends WalletCurrency>({
  convertMoneyAmount,
  sendingWalletDescriptor,
}: CreatePaymentDetailParams<T>) =>
  createIntraledgerPaymentDetails({
    handle: intraledgerHandle,
    recipientWalletId: intraledgerWalletId,
    sendingWalletDescriptor,
    convertMoneyAmount,
    unitOfAccountAmount: ZeroBtcMoneyAmount,
  })

const intraledgerPaymentDestination: PaymentDestination = {
  valid: true,
  validDestination: intraledgerValidDestination,
  destinationDirection: DestinationDirection.Send,
  createPaymentDetail: createIntraledgerPaymentDetail,
}

const intraledgerRoute = {
  key: "sendBitcoinDetailsScreen",
  name: "sendBitcoinDetails",
  params: {
    paymentDestination: intraledgerPaymentDestination,
  },
} as const

const Intraledger = () => <SendBitcoinDetailsScreen route={intraledgerRoute} />

const onchainAddress = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"

const onchainValidDestination = {
  valid: true as const,
  paymentType: PaymentType.Onchain,
  address: onchainAddress,
}

const createOnchainPaymentDetail = <T extends WalletCurrency>({
  convertMoneyAmount,
  sendingWalletDescriptor,
}: CreatePaymentDetailParams<T>) =>
  createNoAmountOnchainPaymentDetails({
    address: onchainAddress,
    sendingWalletDescriptor,
    convertMoneyAmount,
    unitOfAccountAmount: ZeroBtcMoneyAmount,
  })

const onchainPaymentDestination: PaymentDestination = {
  valid: true,
  validDestination: onchainValidDestination as never,
  destinationDirection: DestinationDirection.Send,
  createPaymentDetail: createOnchainPaymentDetail,
}

const onchainRoute = {
  key: "sendBitcoinDetailsScreen",
  name: "sendBitcoinDetails",
  params: {
    paymentDestination: onchainPaymentDestination,
  },
} as const

const Onchain = () => <SendBitcoinDetailsScreen route={onchainRoute} />

it("SendScreen Details", async () => {
  render(
    <ContextForScreen>
      <Intraledger />
    </ContextForScreen>,
  )
  await act(async () => {})
})

it("applies send amount when Set Amount is pressed", async () => {
  loadLocale("en")
  const LL = i18nObject("en")

  render(
    <ContextForScreen>
      <Intraledger />
    </ContextForScreen>,
  )

  const nextButton = await screen.findByTestId(LL.common.next())
  expect(nextButton.props.accessibilityState?.disabled).toBe(true)

  await flushAsync()
  await flushAsync()

  fireEvent.press(screen.getByTestId("Amount Input Button"))
  await flushAsync()

  fireEvent.press(screen.getByTestId("Key 1"))
  await flushAsync()

  const setAmountButtons = screen.getAllByText(LL.AmountInputScreen.setAmount())
  fireEvent.press(setAmountButtons[setAmountButtons.length - 1])

  await waitFor(() => {
    expect(screen.getByTestId(LL.common.next()).props.accessibilityState?.disabled).toBe(
      false,
    )
  })
})

describe("SendBitcoinDetailsScreen — LNURL requestInvoice gate", () => {
  const lnurlParams: LnUrlPayServiceResponse = {
    callback: "https://example.com/cb",
    fixed: false,
    min: 1 as Satoshis,
    max: 1000000 as Satoshis,
    domain: "example.com",
    metadata: [["text/plain", "Test"]],
    metadataHash: "",
    identifier: "alice@example.com",
    description: "Pay alice",
    image: "",
    commentAllowed: 0,
    rawData: { metadata: '[["text/plain","Test"]]' },
  }

  const convertMoneyAmount: ConvertMoneyAmount = (amount, currency) => ({
    amount: amount.amount,
    currency,
    currencyCode: currency,
  })

  const buildLnurlPaymentDetail = ({
    withSendMutation,
  }: {
    withSendMutation: boolean
  }): PaymentDetail<WalletCurrency> => {
    const sendingWalletDescriptor = {
      id: "btc-wallet-id",
      currency: WalletCurrency.Btc,
    } as const
    const unitOfAccountAmount = {
      amount: 5000,
      currency: WalletCurrency.Btc,
      currencyCode: WalletCurrency.Btc,
    } as const
    const settlementAmount = {
      amount: 5000,
      currency: WalletCurrency.Btc,
      currencyCode: WalletCurrency.Btc,
    } as const
    const detail = {
      paymentType: PaymentType.Lnurl,
      destination: "lnurl1abc",
      memo: "",
      convertMoneyAmount,
      setConvertMoneyAmount: () => detail,
      settlementAmount,
      settlementAmountIsEstimated: false,
      unitOfAccountAmount,
      sendingWalletDescriptor,
      setSendingWalletDescriptor: () => detail,
      lnurlParams,
      setInvoice: () => detail,
      successAction: undefined,
      setSuccessAction: () => detail,
      isMerchant: false,
      canSetAmount: true as const,
      setAmount: () => detail,
      canSetMemo: true as const,
      setMemo: () => detail,
      ...(withSendMutation
        ? {
            canSendPayment: true as const,
            canGetFee: true as const,
            getFee: jest.fn().mockResolvedValue({ amount: undefined }),
            sendPaymentMutation: jest.fn().mockResolvedValue({ status: "SUCCESS" }),
          }
        : { canSendPayment: false as const, canGetFee: false as const }),
    }
    return detail as unknown as PaymentDetail<WalletCurrency>
  }

  const buildRoute = (paymentDetail: PaymentDetail<WalletCurrency>) =>
    ({
      key: "sendBitcoinDetails",
      name: "sendBitcoinDetails",
      params: {
        paymentDestination: {
          valid: true,
          createPaymentDetail: () => paymentDetail,
        } as never,
      },
    }) as never

  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
  })

  it("does NOT call lnurl-pay requestInvoice when paymentDetail.sendPaymentMutation is set (self-custodial path)", async () => {
    const detail = buildLnurlPaymentDetail({ withSendMutation: true })
    const LL = i18nObject("en")

    render(
      <ContextForScreen>
        <SendBitcoinDetailsScreen route={buildRoute(detail)} />
      </ContextForScreen>,
    )

    await flushAsync()
    await flushAsync()

    fireEvent.press(screen.getByText(LL.common.next()))
    await flushAsync()

    expect(mockRequestInvoice).not.toHaveBeenCalled()
    expect(mockRequestInvoiceWithServiceParams).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith(
      "sendBitcoinConfirmation",
      expect.objectContaining({ paymentDetail: expect.any(Object) }),
    )
  })

  it("calls lnurl-pay requestInvoice when paymentDetail.sendPaymentMutation is missing (custodial path)", async () => {
    const detail = buildLnurlPaymentDetail({ withSendMutation: false })
    const LL = i18nObject("en")
    mockRequestInvoiceWithServiceParams.mockResolvedValue({
      invoice: "lnbc10n1pjxample",
      successAction: undefined,
    })

    render(
      <ContextForScreen>
        <SendBitcoinDetailsScreen route={buildRoute(detail)} />
      </ContextForScreen>,
    )

    await flushAsync()
    await flushAsync()

    fireEvent.press(screen.getByText(LL.common.next()))
    await flushAsync()

    expect(mockRequestInvoiceWithServiceParams).toHaveBeenCalledTimes(1)
    expect(mockRequestInvoiceWithServiceParams).toHaveBeenCalledWith(
      expect.objectContaining({ params: lnurlParams }),
    )
  })

  // requestInvoice(lnUrlOrAddress) would resolve the destination again and fetch
  // whatever callback the second response carries, bypassing the https check
  // resolveLnurlDestination performed on the params held here.
  it("pays with the vetted service params and never re-resolves the destination", async () => {
    const detail = buildLnurlPaymentDetail({ withSendMutation: false })
    const LL = i18nObject("en")
    mockRequestInvoiceWithServiceParams.mockResolvedValue({
      invoice: "lnbc10n1pjxample",
      successAction: undefined,
    })

    render(
      <ContextForScreen>
        <SendBitcoinDetailsScreen route={buildRoute(detail)} />
      </ContextForScreen>,
    )

    await flushAsync()
    await flushAsync()

    fireEvent.press(screen.getByText(LL.common.next()))
    await flushAsync()

    const args = mockRequestInvoiceWithServiceParams.mock.calls[0][0]
    expect(args.params.callback).toBe("https://example.com/cb")
    expect(args).not.toHaveProperty("lnUrlOrAddress")
    expect(mockRequestInvoice).not.toHaveBeenCalled()
  })
})

describe("onchain fee tier gating", () => {
  it("renders the speed selector for a custodial onchain send", async () => {
    render(
      <ContextForScreen>
        <Onchain />
      </ContextForScreen>,
    )

    // The render condition widened from "self-custodial and onchain" to any onchain send.
    expect(await screen.findByTestId("fee-tier-dropdown")).toBeTruthy()
  })

  it("keeps the speed selector off an intraledger send", async () => {
    render(
      <ContextForScreen>
        <Intraledger />
      </ContextForScreen>,
    )
    await flushAsync()

    expect(screen.queryByTestId("fee-tier-dropdown")).toBeNull()
  })

  it("labels the tiers without a fee while none has been quoted", async () => {
    loadLocale("en")
    const LL = i18nObject("en")

    render(
      <ContextForScreen>
        <Onchain />
      </ContextForScreen>,
    )
    await screen.findByTestId("fee-tier-dropdown")
    await flushAsync()

    // A zeroed placeholder must never read as a fee somebody quoted.
    expect(screen.getByText(LL.SendBitcoinScreen.fast())).toBeTruthy()
    expect(screen.queryByText(`${LL.SendBitcoinScreen.fast()} (0 sats)`)).toBeNull()
  })

  it("adopts the tier the user picks", async () => {
    loadLocale("en")
    const LL = i18nObject("en")

    render(
      <ContextForScreen>
        <Onchain />
      </ContextForScreen>,
    )
    await screen.findByTestId("fee-tier-dropdown")
    await flushAsync()

    fireEvent.press(screen.getByTestId("fee-tier-dropdown"))
    fireEvent.press(screen.getByTestId("fee-tier-slow"))
    await flushAsync()

    expect(screen.getAllByText(LL.SendBitcoinScreen.slow()).length).toBeGreaterThan(0)
  })

  it("carries the quoted fee into the tier label", async () => {
    loadLocale("en")
    const LL = i18nObject("en")

    render(
      <ContextForScreen>
        <Onchain />
      </ContextForScreen>,
    )
    await screen.findByTestId("fee-tier-dropdown")
    await flushAsync()

    fireEvent.press(screen.getByTestId("Amount Input Button"))
    await flushAsync()
    fireEvent.press(screen.getByTestId("Key 1"))
    await flushAsync()
    const setAmountButtons = screen.getAllByText(LL.AmountInputScreen.setAmount())
    fireEvent.press(setAmountButtons[setAmountButtons.length - 1])
    await flushAsync()

    // The fee itself is formatted in the display currency, so only its presence is asserted.
    await waitFor(() => {
      expect(
        screen.getByText(new RegExp(`^${LL.SendBitcoinScreen.fast()} \\(`)),
      ).toBeTruthy()
    })
    expect(screen.queryByText(LL.common.feeError())).toBeNull()
    expect(screen.getByTestId(LL.common.next()).props.accessibilityState?.disabled).toBe(
      false,
    )
  })

  it("leaves Next enabled when a custodial quote fails", async () => {
    loadLocale("en")
    const LL = i18nObject("en")
    mockQuoteFees.mockResolvedValue(failedQuote)

    render(
      <ContextForScreen>
        <Onchain />
      </ContextForScreen>,
    )
    await screen.findByTestId("fee-tier-dropdown")
    await flushAsync()

    fireEvent.press(screen.getByTestId("Amount Input Button"))
    await flushAsync()
    fireEvent.press(screen.getByTestId("Key 1"))
    await flushAsync()
    const setAmountButtons = screen.getAllByText(LL.AmountInputScreen.setAmount())
    fireEvent.press(setAmountButtons[setAmountButtons.length - 1])
    await flushAsync()

    /**
     * The pairing is the point: the failure is surfaced and the sender can still continue.
     * A custodial quote is only an estimate, since the confirmation screen fetches its own
     * and the mutation validates server-side.
     */
    await waitFor(() => {
      expect(screen.getByText(LL.common.feeError())).toBeTruthy()
    })
    expect(screen.getByTestId(LL.common.next()).props.accessibilityState?.disabled).toBe(
      false,
    )
  })

  /**
   * The high-fee warning is judged by the fee the selector quoted, so leaving before the
   * quote lands would leave without the warning.
   */
  it("holds Next while the custodial quote is still out", async () => {
    loadLocale("en")
    const LL = i18nObject("en")
    mockQuoteFees.mockResolvedValue(failedQuote)

    render(
      <ContextForScreen>
        <Onchain />
      </ContextForScreen>,
    )
    await screen.findByTestId("fee-tier-dropdown")
    await flushAsync()

    fireEvent.press(screen.getByTestId("Amount Input Button"))
    await flushAsync()
    fireEvent.press(screen.getByTestId("Key 1"))
    await flushAsync()
    const setAmountButtons = screen.getAllByText(LL.AmountInputScreen.setAmount())
    fireEvent.press(setAmountButtons[setAmountButtons.length - 1])

    // Asserted before flushing: the quote goes out on this render and nothing is back yet.
    expect(screen.getByTestId(LL.common.next()).props.accessibilityState?.disabled).toBe(
      true,
    )

    await waitFor(() => {
      expect(screen.getByText(LL.common.feeError())).toBeTruthy()
    })
    expect(screen.getByTestId(LL.common.next()).props.accessibilityState?.disabled).toBe(
      false,
    )
  })

  /**
   * The extra-info box shows one message, and an amount the account cannot send is the one
   * the sender can act on. The same amount also fails to quote, so without an order between
   * them the fee error takes the box and hides both the limit and the way past it.
   */
  it("keeps the limit error in the box when the quote fails for the same amount", async () => {
    loadLocale("en")
    const LL = i18nObject("en")
    mockWithdrawalAllowance.remaining = 500
    mockQuoteFees.mockResolvedValue(failedQuote)

    render(
      <ContextForScreen>
        <Onchain />
      </ContextForScreen>,
    )
    await screen.findByTestId("fee-tier-dropdown")
    await flushAsync()

    fireEvent.press(screen.getByTestId("Amount Input Button"))
    await flushAsync()
    // Against the mocked price 9,999 NGN is $99.99, well past the $5 left on the limit.
    fireEvent.press(screen.getByTestId("Key 9"))
    fireEvent.press(screen.getByTestId("Key 9"))
    fireEvent.press(screen.getByTestId("Key 9"))
    fireEvent.press(screen.getByTestId("Key 9"))
    await flushAsync()
    const setAmountButtons = screen.getAllByText(LL.AmountInputScreen.setAmount())
    fireEvent.press(setAmountButtons[setAmountButtons.length - 1])
    await flushAsync()

    // Matched by its opening words, since the allowance is formatted into the rest of it.
    const amountExceedsLimitOpening = LL.SendBitcoinScreen.amountExceedsLimit({
      limit: "",
    }).trim()

    await waitFor(() => {
      expect(screen.getByText(new RegExp(`^${amountExceedsLimitOpening}`))).toBeTruthy()
    })
    expect(screen.queryByText(LL.common.feeError())).toBeNull()
    expect(screen.getByTestId(LL.common.next()).props.accessibilityState?.disabled).toBe(
      true,
    )
  })
})
