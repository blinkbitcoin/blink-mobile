import React from "react"
import { View } from "react-native"
import { it } from "@jest/globals"

import { act, fireEvent, render, screen, within } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import SendBitcoinDestinationScreen from "@app/screens/send-bitcoin-screen/send-bitcoin-destination-screen"
import {
  DestinationDirection,
  InvalidDestinationReason,
  ParseDestinationResult,
} from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import { parseDestination } from "@app/screens/send-bitcoin-screen/payment-destination"
import { LnUrlPayServiceResponse, Satoshis } from "lnurl-pay"

import {
  InvalidIntraledgerReason,
  InvalidOnchainDestinationReason,
  ParsedPaymentDestination,
  PaymentType,
} from "@blinkbitcoin/blink-client"

import Clipboard from "@react-native-clipboard/clipboard"

import { ContextForScreen } from "./helper"

type MockedContact = {
  id: string
  handle: string
  username: string | null
  alias: string | null
  transactionsCount: number
}

type MockedDestinationData = {
  globals: { network: string }
  me: {
    id: string
    defaultAccount: {
      id: string
      wallets: Array<{ id: string }>
    }
    contacts: MockedContact[]
  }
}

const flushAsync = async () => {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve()
      }, 0)
    })
  })
}

let mockedDestinationData: MockedDestinationData = {
  globals: { network: "mainnet" },
  me: {
    id: "mocked-user-id",
    defaultAccount: {
      id: "mocked-account-id",
      wallets: [{ id: "btc-wallet-id" }],
    },
    contacts: [],
  },
}

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useSendBitcoinDestinationQuery: jest.fn(() => ({
    loading: false,
    data: mockedDestinationData,
  })),
  useRealtimePriceQuery: jest.fn(() => ({})),
  useAccountDefaultWalletLazyQuery: jest.fn(() => [jest.fn()]),
}))

jest.mock("@app/screens/send-bitcoin-screen/payment-destination", () => ({
  ...jest.requireActual("@app/screens/send-bitcoin-screen/payment-destination"),
  parseDestination: jest.fn(),
}))

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  default: () => ({ countryCode: "SV", loading: false }),
}))

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({
    appConfig: {
      galoyInstance: { lnAddressHostname: "blink.sv", name: "Blink" },
    },
  }),
}))

jest.mock("@react-native-clipboard/clipboard", () => ({
  getString: jest.fn(() => Promise.resolve("clipboard")),
  setString: jest.fn(),
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}))

const activeWalletWallets = [
  {
    id: "btc-wallet-id",
    walletCurrency: "BTC",
    balance: { currency: "BTC", currencyCode: "BTC", amount: 0 },
  },
]
const useActiveWalletMock = jest.fn(() => ({
  isSelfCustodial: false,
  isReady: true,
  needsBackendAuth: false,
  wallets: activeWalletWallets,
  status: "ready",
  accountType: "Custodial",
}))
jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => useActiveWalletMock(),
}))

const useSelfCustodialWalletMock = jest.fn(() => ({ sdk: undefined }))
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => useSelfCustodialWalletMock(),
}))

const useScanContextMock = jest.fn(() => ({
  myWalletIds: ["btc-wallet-id"],
  bitcoinNetwork: "mainnet",
  lnurlDomains: ["blink.sv", "blink.sv", "pay.blink.sv", "pay.bbw.sv"],
}))
jest.mock("@app/hooks/use-scan-context", () => ({
  useScanContext: () => useScanContextMock(),
}))

jest.mock("@app/self-custodial/payment-details/wrap-destination", () => ({
  wrapDestination: jest.fn(
    (result: ParseDestinationResult): ParseDestinationResult => result,
  ),
}))

const sendBitcoinDestination = {
  name: "sendBitcoinDestination",
  key: "sendBitcoinDestination",
  params: {
    payment: "",
    username: "",
  },
} as const

const getResponderByLabel = (label: string) => {
  const responders = screen
    .UNSAFE_getAllByType(View)
    .filter((node) => typeof node.props.onResponderRelease === "function")
  const match = responders.find((node) => within(node).queryByLabelText(label))
  if (!match) {
    throw new Error(`Responder not found for label: ${label}`)
  }
  return match
}

describe("SendBitcoinDestinationScreen", () => {
  let LL: ReturnType<typeof i18nObject>
  const parseDestinationMock = parseDestination as jest.MockedFunction<
    typeof parseDestination
  >

  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    LL = i18nObject("en")
    useActiveWalletMock.mockReturnValue({
      isSelfCustodial: false,
      isReady: true,
      needsBackendAuth: false,
      wallets: activeWalletWallets,
      status: "ready",
      accountType: "Custodial",
    })
    useSelfCustodialWalletMock.mockReturnValue({ sdk: undefined })
    useScanContextMock.mockReturnValue({
      myWalletIds: ["btc-wallet-id"],
      bitcoinNetwork: "mainnet",
      lnurlDomains: ["blink.sv", "blink.sv", "pay.blink.sv", "pay.bbw.sv"],
    })
    mockedDestinationData = {
      globals: { network: "mainnet" },
      me: {
        id: "mocked-user-id",
        defaultAccount: {
          id: "mocked-account-id",
          wallets: [{ id: "btc-wallet-id" }],
        },
        contacts: [],
      },
    }
  })

  const createLnurlPayParams = (identifier: string): LnUrlPayServiceResponse => ({
    callback: "mocked_callback",
    fixed: true,
    min: 0 as Satoshis,
    max: 2000 as Satoshis,
    domain: "example.com",
    metadata: [
      ["text/plain", "description"],
      ["image/png;base64", "base64EncodedImage"],
    ],
    metadataHash: "mocked_metadata_hash",
    identifier,
    description: "mocked_description",
    image: "mocked_image_url",
    commentAllowed: 140,
    rawData: {},
  })

  const createUsernameDoesNotExistResult = (handle: string): ParseDestinationResult => {
    const invalidPaymentDestination: ParsedPaymentDestination = {
      valid: false,
      paymentType: PaymentType.Intraledger,
      invalidReason: InvalidIntraledgerReason.WrongDomain,
      handle,
    }

    return {
      valid: false,
      invalidReason: InvalidDestinationReason.UsernameDoesNotExist,
      invalidPaymentDestination,
    }
  }

  const createInvalidAmountResult = (): ParseDestinationResult => {
    const invalidPaymentDestination: ParsedPaymentDestination = {
      valid: false,
      paymentType: PaymentType.Onchain,
      invalidReason: InvalidOnchainDestinationReason.InvalidAmount,
    }

    return {
      valid: false,
      invalidReason: InvalidDestinationReason.InvalidAmount,
      invalidPaymentDestination,
    }
  }

  it.each([
    {
      name: "shows confirm modal for a new phone destination",
      contacts: [],
      shouldShowModal: true,
    },
    {
      name: "does not show confirm modal for a known phone destination",
      contacts: [
        {
          id: "contact-id",
          handle: "+50370000000",
          username: "+50370000000",
          alias: null,
          transactionsCount: 1,
        },
      ],
      shouldShowModal: false,
    },
  ])("$name", async ({ contacts, shouldShowModal }) => {
    mockedDestinationData = {
      ...mockedDestinationData,
      me: {
        ...mockedDestinationData.me,
        contacts,
      },
    }

    parseDestinationMock.mockResolvedValue({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: {
        valid: true,
        paymentType: PaymentType.Lnurl,
        lnurl: "lnurl",
        isMerchant: false,
        lnurlParams: createLnurlPayParams("+50370000000"),
      },
      createPaymentDetail: jest.fn(),
    })

    render(
      <ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination} />
      </ContextForScreen>,
    )

    fireEvent.changeText(screen.getByLabelText("telephoneNumber"), "70000000")
    await flushAsync()
    fireEvent.press(screen.getByLabelText(LL.common.next()))
    await flushAsync()

    const modalTitle = LL.SendBitcoinDestinationScreen.confirmUsernameModal.title()

    if (shouldShowModal) {
      expect(await screen.findByText(modalTitle)).toBeTruthy()
      return
    }
    expect(screen.queryByText(modalTitle)).toBeNull()
  })

  it("strips domain from LNURL identifier to prevent doubled @blink.sv in confirm modal", async () => {
    parseDestinationMock.mockResolvedValue({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: {
        valid: true,
        paymentType: PaymentType.Lnurl,
        lnurl: "lnurl",
        isMerchant: false,
        lnurlParams: createLnurlPayParams("+50370000000@blink.sv"),
      },
      createPaymentDetail: jest.fn(),
    })

    render(
      <ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination} />
      </ContextForScreen>,
    )

    fireEvent.changeText(screen.getByLabelText("telephoneNumber"), "70000000")
    await flushAsync()
    fireEvent.press(screen.getByLabelText(LL.common.next()))
    await flushAsync()

    expect(
      await screen.findByText(
        LL.SendBitcoinDestinationScreen.confirmUsernameModal.title(),
      ),
    ).toBeTruthy()

    // The checkbox label should show +50370000000@blink.sv (single domain),
    // NOT +50370000000@blink.sv@blink.sv (doubled domain)
    expect(
      screen.getByLabelText(
        LL.SendBitcoinDestinationScreen.confirmUsernameModal.checkBox({
          lnAddress: "+50370000000@blink.sv",
        }),
      ),
    ).toBeTruthy()
  })

  it.each([
    {
      name: "shows invalid phone error for malformed numbers",
      input: "123",
      shouldCallParse: false,
      expectedError: "invalid",
    },
    {
      name: "accepts valid phone numbers",
      input: "70000000",
      shouldCallParse: true,
      expectedError: "none",
    },
  ])("$name", async ({ input, shouldCallParse, expectedError }) => {
    parseDestinationMock.mockResolvedValue({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: {
        valid: true,
        paymentType: PaymentType.Lnurl,
        lnurl: "lnurl",
        isMerchant: false,
        lnurlParams: createLnurlPayParams(input),
      },
      createPaymentDetail: jest.fn(),
    })

    render(
      <ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination} />
      </ContextForScreen>,
    )

    fireEvent.changeText(screen.getByLabelText("telephoneNumber"), input)
    await flushAsync()
    fireEvent.press(screen.getByLabelText(LL.common.next()))

    await flushAsync()

    if (expectedError === "invalid") {
      expect(
        await screen.findByText(LL.SendBitcoinDestinationScreen.invalidPhoneNumber()),
      ).toBeTruthy()
    }
    if (expectedError === "none") {
      expect(
        screen.queryByText(LL.SendBitcoinDestinationScreen.invalidPhoneNumber()),
      ).toBeNull()
    }
    if (shouldCallParse) {
      expect(parseDestinationMock).toHaveBeenCalled()
      return
    }
    expect(parseDestinationMock).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: "rejects phone numbers in the search input",
      input: "123456",
      expectPhoneNotAllowed: true,
    },
    {
      name: "accepts usernames in the search input",
      input: "newuser",
      expectPhoneNotAllowed: false,
    },
  ])("$name", async ({ input, expectPhoneNotAllowed }) => {
    parseDestinationMock.mockResolvedValue({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: {
        valid: true,
        paymentType: PaymentType.Intraledger,
        handle: input,
        walletId: "wallet-id",
      },
      createPaymentDetail: jest.fn(),
    })

    render(
      <ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination} />
      </ContextForScreen>,
    )

    fireEvent.changeText(screen.getByLabelText(LL.SendBitcoinScreen.placeholder()), input)
    fireEvent.press(screen.getByLabelText(LL.common.next()))

    await flushAsync()

    const phoneNotAllowed = LL.SendBitcoinDestinationScreen.phoneNotAllowed()

    if (expectPhoneNotAllowed) {
      expect(await screen.findByText(phoneNotAllowed)).toBeTruthy()
      expect(parseDestinationMock).not.toHaveBeenCalled()
      return
    }
    expect(screen.queryByText(phoneNotAllowed)).toBeNull()
    expect(parseDestinationMock).toHaveBeenCalled()
  })

  it.each([
    {
      name: "shows username does not exist error",
      input: "missinguser",
      result: createUsernameDoesNotExistResult("missinguser"),
      expectedText: (ll: ReturnType<typeof i18nObject>) =>
        ll.SendBitcoinDestinationScreen.usernameDoesNotExist({
          lnAddress: "missinguser@blink.sv",
          bankName: "Blink",
        }),
    },
    {
      name: "shows invalid amount error",
      input: "btc:invalid",
      result: createInvalidAmountResult(),
      expectedText: (ll: ReturnType<typeof i18nObject>) =>
        ll.SendBitcoinDestinationScreen.invalidAmount(),
    },
  ])("$name", async ({ input, result, expectedText }) => {
    parseDestinationMock.mockResolvedValue(result)

    render(
      <ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination} />
      </ContextForScreen>,
    )

    fireEvent.changeText(screen.getByLabelText(LL.SendBitcoinScreen.placeholder()), input)
    fireEvent.press(screen.getByLabelText(LL.common.next()))

    await flushAsync()

    expect(await screen.findByText(expectedText(LL))).toBeTruthy()
  })

  it("validates clipboard content when pasting into the search input", async () => {
    parseDestinationMock.mockResolvedValue({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: {
        valid: true,
        paymentType: PaymentType.Intraledger,
        handle: "clipboard",
        walletId: "wallet-id",
      },
      createPaymentDetail: jest.fn(),
    })

    render(
      <ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination} />
      </ContextForScreen>,
    )

    const searchResponder = getResponderByLabel(LL.SendBitcoinScreen.placeholder())
    const pasteButton = within(searchResponder).getByText(LL.common.paste())
    fireEvent.press(pasteButton)

    await flushAsync()
    await flushAsync()

    expect(parseDestinationMock).toHaveBeenCalledWith(
      expect.objectContaining({ rawInput: "clipboard" }),
    )
  })

  it.each([
    {
      name: "switches focus to phone when tapping paste on the disabled phone input",
      triggerLabel: "telephoneNumber",
      initialInputLabel: "search",
      initialValue: "alice",
      expectedClearedLabel: "search",
    },
    {
      name: "switches focus to search when tapping paste on the disabled search input",
      triggerLabel: "search",
      initialInputLabel: "phone",
      initialValue: "70000000",
      expectedClearedLabel: "phone",
    },
  ])(
    "$name",
    async ({ triggerLabel, initialInputLabel, initialValue, expectedClearedLabel }) => {
      render(
        <ContextForScreen>
          <SendBitcoinDestinationScreen route={sendBitcoinDestination} />
        </ContextForScreen>,
      )

      const searchInput = screen.getByLabelText(LL.SendBitcoinScreen.placeholder())
      const phoneInput = screen.getByLabelText("telephoneNumber")

      if (initialInputLabel === "search") {
        fireEvent.changeText(searchInput, initialValue)
      }
      if (initialInputLabel === "phone") {
        fireEvent.changeText(phoneInput, initialValue)
      }

      await flushAsync()

      const responderLabel =
        triggerLabel === "search" ? LL.SendBitcoinScreen.placeholder() : "telephoneNumber"
      const responder = getResponderByLabel(responderLabel)

      fireEvent(responder, "onResponderRelease")

      await flushAsync()

      if (expectedClearedLabel === "search") {
        expect(searchInput.props.value).toBe("")
        return
      }
      expect(phoneInput.props.value).toBe("")
    },
  )

  it("shows confirm modal only once for the same destination", async () => {
    const handle = "newuser"
    const lnAddress = `${handle}@blink.sv`

    parseDestinationMock.mockResolvedValue({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: {
        valid: true,
        paymentType: PaymentType.Intraledger,
        handle,
        walletId: "wallet-id",
      },
      createPaymentDetail: jest.fn(),
    })

    render(
      <ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination} />
      </ContextForScreen>,
    )

    fireEvent.changeText(
      screen.getByLabelText(LL.SendBitcoinScreen.placeholder()),
      handle,
    )
    fireEvent.press(screen.getByLabelText(LL.common.next()))

    await flushAsync()

    expect(
      await screen.findByText(
        LL.SendBitcoinDestinationScreen.confirmUsernameModal.title(),
      ),
    ).toBeTruthy()

    fireEvent.press(
      screen.getByLabelText(
        LL.SendBitcoinDestinationScreen.confirmUsernameModal.checkBox({
          lnAddress,
        }),
      ),
    )
    fireEvent.press(
      screen.getByLabelText(
        LL.SendBitcoinDestinationScreen.confirmUsernameModal.confirmButton(),
      ),
    )

    await flushAsync()

    fireEvent.press(screen.getByLabelText(LL.common.next()))

    await flushAsync()

    expect(
      screen.queryByText(LL.SendBitcoinDestinationScreen.confirmUsernameModal.title()),
    ).toBeNull()
  })

  it("shows confirm modal again for a different destination", async () => {
    const firstHandle = "newuser"
    const secondHandle = "anotheruser"

    parseDestinationMock.mockImplementation(({ rawInput }) =>
      Promise.resolve({
        valid: true,
        destinationDirection: DestinationDirection.Send,
        validDestination: {
          valid: true,
          paymentType: PaymentType.Intraledger,
          handle: rawInput,
          walletId: "wallet-id",
        },
        createPaymentDetail: jest.fn(),
      }),
    )

    render(
      <ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination} />
      </ContextForScreen>,
    )

    fireEvent.changeText(
      screen.getByLabelText(LL.SendBitcoinScreen.placeholder()),
      firstHandle,
    )
    fireEvent.press(screen.getByLabelText(LL.common.next()))

    await flushAsync()

    fireEvent.press(
      screen.getByLabelText(
        LL.SendBitcoinDestinationScreen.confirmUsernameModal.checkBox({
          lnAddress: `${firstHandle}@blink.sv`,
        }),
      ),
    )
    fireEvent.press(
      screen.getByLabelText(
        LL.SendBitcoinDestinationScreen.confirmUsernameModal.confirmButton(),
      ),
    )

    fireEvent.changeText(
      screen.getByLabelText(LL.SendBitcoinScreen.placeholder()),
      secondHandle,
    )
    fireEvent.press(screen.getByLabelText(LL.common.next()))

    await flushAsync()

    expect(
      await screen.findByText(
        LL.SendBitcoinDestinationScreen.confirmUsernameModal.title(),
      ),
    ).toBeTruthy()
  })

  it("does not show confirm modal for a known contact", async () => {
    const knownHandle = "existinguser"
    mockedDestinationData = {
      ...mockedDestinationData,
      me: {
        ...mockedDestinationData.me,
        contacts: [
          {
            id: "contact-id",
            handle: knownHandle,
            username: knownHandle,
            alias: null,
            transactionsCount: 1,
          },
        ],
      },
    }
    parseDestinationMock.mockResolvedValue({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: {
        valid: true,
        paymentType: PaymentType.Intraledger,
        handle: knownHandle,
        walletId: "wallet-id",
      },
      createPaymentDetail: jest.fn(),
    })

    render(
      <ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination} />
      </ContextForScreen>,
    )

    fireEvent.changeText(
      screen.getByLabelText(LL.SendBitcoinScreen.placeholder()),
      knownHandle,
    )
    fireEvent.press(screen.getByLabelText(LL.common.next()))

    await flushAsync()

    expect(
      screen.queryByText(LL.SendBitcoinDestinationScreen.confirmUsernameModal.title()),
    ).toBeNull()
  })

  it("requires confirmation checkbox before enabling confirm button", async () => {
    const handle = "newuser"
    const lnAddress = `${handle}@blink.sv`

    parseDestinationMock.mockResolvedValue({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: {
        valid: true,
        paymentType: PaymentType.Intraledger,
        handle,
        walletId: "wallet-id",
      },
      createPaymentDetail: jest.fn(),
    })

    render(
      <ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination} />
      </ContextForScreen>,
    )

    fireEvent.changeText(
      screen.getByLabelText(LL.SendBitcoinScreen.placeholder()),
      handle,
    )
    fireEvent.press(screen.getByLabelText(LL.common.next()))

    await flushAsync()

    fireEvent.press(
      screen.getByLabelText(
        LL.SendBitcoinDestinationScreen.confirmUsernameModal.confirmButton(),
      ),
    )

    expect(
      await screen.findByText(
        LL.SendBitcoinDestinationScreen.confirmUsernameModal.title(),
      ),
    ).toBeTruthy()

    fireEvent.press(
      screen.getByLabelText(
        LL.SendBitcoinDestinationScreen.confirmUsernameModal.checkBox({
          lnAddress,
        }),
      ),
    )

    fireEvent.press(
      screen.getByLabelText(
        LL.SendBitcoinDestinationScreen.confirmUsernameModal.confirmButton(),
      ),
    )

    expect(
      screen.queryByText(LL.SendBitcoinDestinationScreen.confirmUsernameModal.title()),
    ).toBeNull()
  })

  describe("deep link payment processing (processedPaymentRef)", () => {
    const createRouteWithPayment = (payment: string) =>
      ({
        ...sendBitcoinDestination,
        params: {
          ...sendBitcoinDestination.params,
          payment,
        },
      }) as typeof sendBitcoinDestination

    const setupParseDestinationMock = (
      mock: jest.MockedFunction<typeof parseDestination>,
    ) => {
      mock.mockResolvedValue({
        valid: true,
        destinationDirection: DestinationDirection.Send,
        validDestination: {
          valid: true,
          paymentType: PaymentType.Intraledger,
          handle: "testuser",
          walletId: "wallet-id",
        },
        createPaymentDetail: jest.fn(),
      })
    }

    it("processes route.params.payment on initial render", async () => {
      setupParseDestinationMock(parseDestinationMock)

      const route = createRouteWithPayment("lnurl1testpayment123")

      render(
        <ContextForScreen>
          <SendBitcoinDestinationScreen route={route} />
        </ContextForScreen>,
      )

      await flushAsync()

      expect(parseDestinationMock).toHaveBeenCalledWith(
        expect.objectContaining({ rawInput: "lnurl1testpayment123" }),
      )
      expect(parseDestinationMock).toHaveBeenCalledTimes(1)
    })

    it("does NOT re-process when re-rendered with the same payment param", async () => {
      setupParseDestinationMock(parseDestinationMock)

      const route = createRouteWithPayment("lnurl1testpayment123")

      const { rerender } = render(
        <ContextForScreen>
          <SendBitcoinDestinationScreen route={route} />
        </ContextForScreen>,
      )

      await flushAsync()

      expect(parseDestinationMock).toHaveBeenCalledTimes(1)

      parseDestinationMock.mockClear()

      // Re-render with the exact same payment value
      rerender(
        <ContextForScreen>
          <SendBitcoinDestinationScreen
            route={createRouteWithPayment("lnurl1testpayment123")}
          />
        </ContextForScreen>,
      )

      await flushAsync()

      // The processedPaymentRef should prevent re-processing
      expect(parseDestinationMock).not.toHaveBeenCalled()
    })

    it("processes a NEW payment param after a previous one", async () => {
      setupParseDestinationMock(parseDestinationMock)

      const route = createRouteWithPayment("lnurl1first")

      const { rerender } = render(
        <ContextForScreen>
          <SendBitcoinDestinationScreen route={route} />
        </ContextForScreen>,
      )

      await flushAsync()

      expect(parseDestinationMock).toHaveBeenCalledWith(
        expect.objectContaining({ rawInput: "lnurl1first" }),
      )
      expect(parseDestinationMock).toHaveBeenCalledTimes(1)

      parseDestinationMock.mockClear()

      // Re-render with a DIFFERENT payment value
      rerender(
        <ContextForScreen>
          <SendBitcoinDestinationScreen route={createRouteWithPayment("lnurl1second")} />
        </ContextForScreen>,
      )

      await flushAsync()

      // The new payment should be processed
      expect(parseDestinationMock).toHaveBeenCalledWith(
        expect.objectContaining({ rawInput: "lnurl1second" }),
      )
      expect(parseDestinationMock).toHaveBeenCalledTimes(1)
    })
  })
})
describe("SendBitcoinDestinationScreen paste buttons", () => {
  let LL: ReturnType<typeof i18nObject>
  const parseDestinationMock = parseDestination as jest.MockedFunction<
    typeof parseDestination
  >

  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    LL = i18nObject("en")
  })

  it("search paste button works when phone input is active", async () => {
    parseDestinationMock.mockResolvedValue({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: {
        valid: true,
        paymentType: PaymentType.Intraledger,
        handle: "clipboard",
        walletId: "wallet-id",
      },
      createPaymentDetail: jest.fn(),
    })

    render(
      <ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination} />
      </ContextForScreen>,
    )

    fireEvent.changeText(screen.getByLabelText("telephoneNumber"), "70000000")
    await flushAsync()

    const searchResponder = getResponderByLabel(LL.SendBitcoinScreen.placeholder())
    const pasteButton = within(searchResponder).getByText(LL.common.paste())
    fireEvent.press(pasteButton)
    await flushAsync()
    await flushAsync()

    expect(parseDestinationMock).toHaveBeenCalledWith(
      expect.objectContaining({ rawInput: "clipboard" }),
    )
  })

  it("phone paste button works when search input is active", async () => {
    jest.mocked(Clipboard.getString).mockResolvedValueOnce("+50370000000")

    render(
      <ContextForScreen>
        <SendBitcoinDestinationScreen route={sendBitcoinDestination} />
      </ContextForScreen>,
    )

    const pasteButtons = screen.getAllByText(LL.common.paste())
    const phonePasteButton = pasteButtons[1]

    fireEvent.press(phonePasteButton)
    await flushAsync()
    await flushAsync()

    expect(screen.getByLabelText("telephoneNumber").props.value).toBeTruthy()
  })

  describe("lnurlDomains gate by active wallet type", () => {
    beforeEach(() => {
      // mockReturnValue overrides survive jest.clearAllMocks(); reset to default.
      useActiveWalletMock.mockReturnValue({
        isSelfCustodial: false,
        isReady: true,
        needsBackendAuth: false,
        wallets: activeWalletWallets,
        status: "ready",
        accountType: "Custodial",
      })
      useSelfCustodialWalletMock.mockReturnValue({ sdk: undefined })
      useScanContextMock.mockReturnValue({
        myWalletIds: ["btc-wallet-id"],
        bitcoinNetwork: "mainnet",
        lnurlDomains: ["blink.sv", "blink.sv", "pay.blink.sv", "pay.bbw.sv"],
      })
    })

    const triggerParseDestination = async () => {
      jest.mocked(Clipboard.getString).mockResolvedValueOnce("alice@example.com")
      const searchResponder = getResponderByLabel(LL.SendBitcoinScreen.placeholder())
      const pasteButton = within(searchResponder).getByText(LL.common.paste())
      fireEvent.press(pasteButton)
      await flushAsync()
      await flushAsync()
    }

    it("forwards adapter lnurlDomains=[] from useScanContext (self-custodial)", async () => {
      useActiveWalletMock.mockReturnValue({
        isSelfCustodial: true,
        isReady: true,
        needsBackendAuth: false,
        wallets: activeWalletWallets,
        status: "ready",
        accountType: "SelfCustodial",
      })
      useScanContextMock.mockReturnValue({
        myWalletIds: ["btc-wallet-id"],
        bitcoinNetwork: "mainnet",
        lnurlDomains: [],
      })
      parseDestinationMock.mockResolvedValue({
        valid: false,
        invalidReason: InvalidDestinationReason.UsernameDoesNotExist,
        invalidPaymentDestination: {
          valid: false,
          paymentType: PaymentType.Intraledger,
          invalidReason: InvalidIntraledgerReason.WrongDomain,
          handle: "alice@example.com",
        },
      })

      render(
        <ContextForScreen>
          <SendBitcoinDestinationScreen route={sendBitcoinDestination} />
        </ContextForScreen>,
      )
      await triggerParseDestination()

      expect(parseDestinationMock).toHaveBeenCalledWith(
        expect.objectContaining({ lnurlDomains: [] }),
      )
    })

    it("forwards adapter lnurlDomains from useScanContext (custodial)", async () => {
      parseDestinationMock.mockResolvedValue({
        valid: false,
        invalidReason: InvalidDestinationReason.UsernameDoesNotExist,
        invalidPaymentDestination: {
          valid: false,
          paymentType: PaymentType.Intraledger,
          invalidReason: InvalidIntraledgerReason.WrongDomain,
          handle: "alice@example.com",
        },
      })

      render(
        <ContextForScreen>
          <SendBitcoinDestinationScreen route={sendBitcoinDestination} />
        </ContextForScreen>,
      )
      await triggerParseDestination()

      expect(parseDestinationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          lnurlDomains: ["blink.sv", "blink.sv", "pay.blink.sv", "pay.bbw.sv"],
        }),
      )
    })
  })
})
