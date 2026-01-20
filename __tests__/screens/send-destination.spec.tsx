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

const sendBitcoinDestination = {
  name: "sendBitcoinDestination",
  key: "sendBitcoinDestination",
  params: {
    payment: "",
    username: "",
  },
} as const

describe("SendBitcoinDestinationScreen", () => {
  let LL: ReturnType<typeof i18nObject>
  const parseDestinationMock = parseDestination as jest.MockedFunction<
    typeof parseDestination
  >

  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    LL = i18nObject("en")
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
})
