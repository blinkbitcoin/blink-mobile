import { it } from "@jest/globals"
import React from "react"
import { AppState, AppStateStatus, Text } from "react-native"

import { ApolloClient } from "@apollo/client"
import { MockedProvider, MockedResponse } from "@apollo/client/testing"
import { act, render, screen } from "@testing-library/react-native"

import { MyLnUpdatesDocument, TxNotificationType } from "@app/graphql/generated"
import { IsAuthedContextProvider } from "@app/graphql/is-authed-context"
import { useLnUpdateHashPaid } from "@app/graphql/ln-update-context"
import { SPLASH_SETTLE_MS } from "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/types"
import { MyLnUpdateSub } from "@app/screens/receive-bitcoin-screen/my-ln-updates-sub"

const mockShowSplash = jest.fn()
jest.mock(
  "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/incoming-transaction-splash-context",
  () => ({
    useIncomingTransactionSplash: () => ({ showSplash: mockShowSplash }),
  }),
)

const transaction = (paymentHash: string) => ({
  __typename: "Transaction",
  id: `tx-${paymentHash}`,
  status: "SUCCESS",
  direction: "RECEIVE",
  memo: null,
  createdAt: 1763424000,
  settlementAmount: 1000,
  settlementFee: 0,
  settlementDisplayFee: "0",
  settlementCurrency: "BTC",
  settlementDisplayAmount: "1",
  settlementDisplayCurrency: "USD",
  settlementPrice: {
    __typename: "PriceOfOneSettlementMinorUnitInDisplayMinorUnit",
    base: 1,
    offset: 0,
    currencyUnit: "USDCENT",
    formattedAmount: "0.1",
  },
  initiationVia: { __typename: "InitiationViaLn", paymentHash, paymentRequest: "lnbc1" },
  settlementVia: { __typename: "SettlementViaLn", preImage: null },
})

const updateMock = (update: Record<string, unknown>): MockedResponse => ({
  request: { query: MyLnUpdatesDocument },
  result: {
    data: { myUpdates: { __typename: "MyUpdatesPayload", errors: [], update } },
  },
})

const paid = (paymentHash: string) =>
  updateMock({
    __typename: "LnUpdate",
    status: "PAID",
    transaction: transaction(paymentHash),
  })

const failed: MockedResponse = {
  request: { query: MyLnUpdatesDocument },
  error: new Error("socket closed"),
}

const PaidHash = () => <Text testID="hash">{useLnUpdateHashPaid()}</Text>

const paidHash = () => screen.getByTestId("hash").props.children

const renderSub = (mocks: MockedResponse[], isAuthed = true) =>
  render(
    <MockedProvider mocks={mocks}>
      <IsAuthedContextProvider value={isAuthed}>
        <MyLnUpdateSub>
          <PaidHash />
        </MyLnUpdateSub>
      </IsAuthedContextProvider>
    </MockedProvider>,
  )

const flush = async (ms = 0) => {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

describe("MyLnUpdateSub", () => {
  let refetchQueries: jest.SpyInstance
  let appStateChange: ((state: AppStateStatus) => void) | null

  beforeEach(() => {
    jest.useFakeTimers()
    mockShowSplash.mockReset().mockReturnValue(false)
    refetchQueries = jest
      .spyOn(ApolloClient.prototype, "refetchQueries")
      .mockImplementation(
        () => Object.assign(Promise.resolve([]), { queries: [] }) as never,
      )
    appStateChange = null
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
      appStateChange = handler as (state: AppStateStatus) => void
      return { remove: jest.fn() } as never
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it("hands a paid lightning hash to Receive", async () => {
    renderSub([paid("hash-1")])
    await flush()

    expect(paidHash()).toBe("hash-1")
  })

  it("does not listen while signed out", async () => {
    renderSub([paid("hash-1")], false)
    await flush()

    expect(paidHash()).toBe("")
  })

  it("restarts the stream after an error, so a later payment still reaches Receive", async () => {
    renderSub([failed, paid("hash-2")])
    await flush()
    expect(paidHash()).toBe("")

    await flush(1000)
    await flush()

    expect(paidHash()).toBe("hash-2")
  })

  it("restarts a dead stream at once when the app comes back to the foreground", async () => {
    renderSub([failed, paid("hash-3")])
    await flush()

    await act(async () => {
      appStateChange?.("active")
    })
    await flush()

    expect(paidHash()).toBe("hash-3")
  })

  it("leaves a live stream alone when the app comes back to the foreground", async () => {
    renderSub([paid("hash-4"), paid("hash-5")])
    await flush()

    await act(async () => {
      appStateChange?.("active")
    })
    await flush()

    expect(paidHash()).toBe("hash-4")
  })

  it("refetches Home for an intraledger receipt and the confirmed on-chain receipt", async () => {
    renderSub([
      updateMock({
        __typename: "IntraLedgerUpdate",
        txNotificationType: TxNotificationType.IntraLedgerReceipt,
        transaction: transaction("intra"),
      }),
    ])
    await flush()
    expect(refetchQueries).toHaveBeenCalledTimes(1)
    expect(paidHash()).toBe("")

    refetchQueries.mockClear()
    renderSub([
      updateMock({
        __typename: "OnChainUpdate",
        txNotificationType: TxNotificationType.OnchainReceipt,
        transaction: transaction("chain"),
      }),
    ])
    await flush()
    expect(refetchQueries).toHaveBeenCalledTimes(1)
  })

  it("does not refetch Home for an outgoing intraledger payment", async () => {
    renderSub([
      updateMock({
        __typename: "IntraLedgerUpdate",
        txNotificationType: TxNotificationType.IntraLedgerPayment,
        transaction: transaction("out"),
      }),
    ])
    await flush()

    expect(refetchQueries).not.toHaveBeenCalled()
  })

  it("waits for the splash entrance before refetching Home", async () => {
    mockShowSplash.mockReturnValue(true)
    renderSub([paid("hash-6")])
    await flush()
    expect(refetchQueries).not.toHaveBeenCalled()

    await flush(SPLASH_SETTLE_MS)

    expect(refetchQueries).toHaveBeenCalledTimes(1)
  })
})
