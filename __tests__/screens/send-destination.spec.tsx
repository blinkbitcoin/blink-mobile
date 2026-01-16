import React from "react"

import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import SendBitcoinDestinationScreen from "@app/screens/send-bitcoin-screen/send-bitcoin-destination-screen"
import { DestinationDirection } from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import { parseDestination } from "@app/screens/send-bitcoin-screen/payment-destination"
import { PaymentType } from "@blinkbitcoin/blink-client"

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

  it("shows confirm modal only once for the same destination", async () => {
    const handle = "newuser"
    const lnAddress = `${handle}@blink.sv`

    ;(parseDestination as jest.Mock).mockResolvedValue({
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

    ;(parseDestination as jest.Mock).mockImplementation(({ rawInput }) =>
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
    ;(parseDestination as jest.Mock).mockResolvedValue({
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

    ;(parseDestination as jest.Mock).mockResolvedValue({
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
