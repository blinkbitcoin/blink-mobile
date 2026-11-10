/**
 * The pending deposit check against a real Apollo client and the app's cache, where the
 * hook spec mocks the query away. What only this level can show: the check and Home read
 * the same pending list on the same account, so an answer written with a leaner shape than
 * Home's would leave Home's read incomplete the moment it found a deposit Home had not
 * seen, and a Home refetch is what keeps the answer here current between checks.
 */
import React from "react"
import {
  ApolloClient,
  ApolloLink,
  ApolloProvider,
  FetchResult,
  NormalizedCacheObject,
  Observable,
} from "@apollo/client"
import { act, renderHook, waitFor } from "@testing-library/react-native"

import { createCache } from "@app/graphql/cache"
import {
  HomeAuthedDocument,
  HomeAuthedQuery,
  MigrationPendingDepositsQuery,
  TransactionFragment,
  TxDirection,
  TxStatus,
  WalletCurrency,
} from "@app/graphql/generated"
import mocks from "@app/graphql/mocks"
import { useCustodialPendingDeposits } from "@app/screens/account-migration/hooks/use-custodial-pending-deposits"
import { PendingDepositCheck, PendingDepositCheckStatus } from "@app/types/migration"

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => true,
}))

const homeResult = mocks.find(({ request }) => request.query === HomeAuthedDocument)
  ?.result?.data as HomeAuthedQuery
const userId = homeResult.me?.id ?? ""
const accountId = homeResult.me?.defaultAccount.id ?? ""

const pendingOnChainDeposit = (id: string): TransactionFragment => ({
  __typename: "Transaction",
  id,
  status: TxStatus.Pending,
  direction: TxDirection.Receive,
  memo: null,
  createdAt: Math.floor(Date.now() / 1000),
  settlementAmount: 5000,
  settlementFee: 0,
  settlementDisplayFee: "0.00",
  settlementCurrency: WalletCurrency.Btc,
  settlementDisplayAmount: "5.00",
  settlementDisplayCurrency: "USD",
  settlementPrice: {
    __typename: "PriceOfOneSettlementMinorUnitInDisplayMinorUnit",
    base: 100000000000,
    offset: 12,
    currencyUnit: "USDCENT",
    formattedAmount: "0.1",
  },
  initiationVia: { __typename: "InitiationViaOnChain", address: "synthetic-address" },
  settlementVia: {
    __typename: "SettlementViaOnChain",
    transactionHash: `synthetic-hash-${id}`,
    arrivalInMempoolEstimatedAt: null,
  },
})

const pendingDepositsAnswer = (
  transactionIds: string[],
): MigrationPendingDepositsQuery => ({
  __typename: "Query",
  me: {
    __typename: "User",
    id: userId,
    defaultAccount: {
      __typename: "ConsumerAccount",
      id: accountId,
      pendingIncomingTransactions: transactionIds.map(pendingOnChainDeposit),
    },
  },
})

/** A network the test answers by hand: each request waits for `answer`, and answering
 *  with none waiting fails the test where it happens. */
const makeNetwork = () => {
  const pending: Array<(data: MigrationPendingDepositsQuery) => void> = []
  const link = new ApolloLink(
    () =>
      new Observable<FetchResult>((observer) => {
        pending.push((data) => {
          observer.next({ data })
          observer.complete()
        })
      }),
  )
  const answer = async (data: MigrationPendingDepositsQuery) => {
    const next = pending.shift()
    if (!next) throw new Error("no request is waiting for an answer")
    await act(async () => {
      next(data)
    })
  }
  return { link, answer, requests: () => pending.length }
}

const makeClient = (link: ApolloLink) => {
  const cache = createCache()
  cache.writeQuery({ query: HomeAuthedDocument, data: homeResult })
  return new ApolloClient({ link, cache })
}

const renderCheck = (client: ApolloClient<NormalizedCacheObject>) =>
  renderHook(() => useCustodialPendingDeposits(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <ApolloProvider client={client}>{children}</ApolloProvider>
    ),
  })

const readHomePendingIds = (client: ApolloClient<NormalizedCacheObject>) =>
  client
    .readQuery<HomeAuthedQuery>({ query: HomeAuthedDocument })
    ?.me?.defaultAccount.pendingIncomingTransactions.map(({ id }) => id)

describe("useCustodialPendingDeposits under a real client", () => {
  it("leaves Home readable, with the deposit, when it finds one Home has not seen", async () => {
    const network = makeNetwork()
    const client = makeClient(network.link)
    const { result } = renderCheck(client)

    await network.answer(pendingDepositsAnswer(["pending-deposit-1"]))
    await waitFor(() => expect(result.current.hasPendingDeposit).toBe(true))

    expect(readHomePendingIds(client)).toEqual(["pending-deposit-1"])
  })

  it("leaves Home readable when a check that runs again finds another deposit", async () => {
    const network = makeNetwork()
    const client = makeClient(network.link)
    const { result } = renderCheck(client)
    await network.answer(pendingDepositsAnswer([]))
    await waitFor(() => expect(result.current.isReady).toBe(true))

    let depositCheck: Promise<PendingDepositCheck> | undefined
    act(() => {
      depositCheck = result.current.check()
    })
    await network.answer(pendingDepositsAnswer(["pending-deposit-2"]))

    expect(await depositCheck).toEqual({ status: PendingDepositCheckStatus.Pending })
    expect(readHomePendingIds(client)).toEqual(["pending-deposit-2"])
  })

  /** What lets a confirmed deposit through without the user checking again: the app
   *  refetches Home on a push notification and on coming back to the foreground. */
  it("follows a Home refetch that finds the deposit settled", async () => {
    const network = makeNetwork()
    const client = makeClient(network.link)
    const { result } = renderCheck(client)
    await network.answer(pendingDepositsAnswer(["pending-deposit-1"]))
    await waitFor(() => expect(result.current.hasPendingDeposit).toBe(true))

    /** Home's write shrinks the list, which Apollo flags in development as a field with
     *  no merge function dropping a reference; the app prints it too whenever a deposit
     *  settles, so it is muted here rather than read as a failure. */
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined)
    act(() => {
      client.writeQuery({ query: HomeAuthedDocument, data: homeResult })
    })
    warn.mockRestore()

    await waitFor(() => expect(result.current.hasPendingDeposit).toBe(false))
    expect(result.current.isReady).toBe(true)
  })

  it("keeps the last answer ready while a check runs again", async () => {
    const network = makeNetwork()
    const client = makeClient(network.link)
    const { result } = renderCheck(client)
    await network.answer(pendingDepositsAnswer(["pending-deposit-1"]))
    await waitFor(() => expect(result.current.hasPendingDeposit).toBe(true))

    act(() => {
      result.current.check()
    })
    await waitFor(() => expect(result.current.loading).toBe(true))

    expect(result.current.isReady).toBe(true)
    expect(result.current.hasPendingDeposit).toBe(true)
    await network.answer(pendingDepositsAnswer([]))
    await waitFor(() => expect(result.current.hasPendingDeposit).toBe(false))
  })

  /** A check run before the first answer (OK tapped as the modal opens) shares that
   *  request, so no older answer can land after a newer one. */
  it("shares the request still out when a check runs before the first answer", async () => {
    const network = makeNetwork()
    const client = makeClient(network.link)
    const { result } = renderCheck(client)
    await waitFor(() => expect(network.requests()).toBe(1))

    let depositCheck: Promise<PendingDepositCheck> | undefined
    act(() => {
      depositCheck = result.current.check()
    })
    await act(async () => {})

    expect(network.requests()).toBe(1)
    await network.answer(pendingDepositsAnswer([]))
    expect(await depositCheck).toEqual({ status: PendingDepositCheckStatus.Clear })
    expect(result.current.hasPendingDeposit).toBe(false)
  })
})
