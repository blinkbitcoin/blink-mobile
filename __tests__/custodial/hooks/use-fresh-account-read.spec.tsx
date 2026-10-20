import React from "react"
import { act, renderHook } from "@testing-library/react-native"
import {
  ApolloClient,
  ApolloLink,
  ApolloProvider,
  FetchResult,
  InMemoryCache,
  Observable,
} from "@apollo/client"

import {
  FreshAccountRead,
  useFreshAccountRead,
} from "@app/custodial/hooks/use-fresh-account-read"
import { SettingsScreenDocument, SettingsScreenQuery } from "@app/graphql/generated"

const meWith = (sats: number): SettingsScreenQuery => ({
  __typename: "Query",
  me: {
    __typename: "User",
    id: "user-1",
    username: "user",
    language: "en",
    totpEnabled: false,
    phone: null,
    email: null,
    defaultAccount: {
      __typename: "ConsumerAccount",
      id: "account-1",
      defaultWalletId: "btc-wallet",
      wallets: [
        {
          __typename: "BTCWallet",
          id: "btc-wallet",
          balance: sats,
          walletCurrency: "BTC",
        },
      ],
    },
  },
})

type Answer = { data?: SettingsScreenQuery; fails?: boolean; errors?: string[] }

/** A network the test answers by hand: each request waits for `answer`. */
const makeNetwork = () => {
  const pending: Array<(answer: Answer) => void> = []
  const link = new ApolloLink(
    () =>
      new Observable<FetchResult>((observer) => {
        pending.push(({ data, fails, errors }) => {
          if (fails) {
            observer.error(new Error("network down"))
            return
          }
          const graphQLErrors = errors?.map((message) => ({ message }))
          observer.next({ data, errors: graphQLErrors } as FetchResult)
          observer.complete()
        })
      }),
  )
  const answer = async (reply: Answer) => {
    const next = pending.shift()
    await act(async () => {
      next?.(reply)
    })
  }
  return { link, answer, requests: () => pending.length }
}

const makeClient = (link: ApolloLink, cachedSats?: number) => {
  const cache = new InMemoryCache({
    possibleTypes: { Wallet: ["BTCWallet", "UsdWallet"] },
  })
  if (cachedSats !== undefined) {
    cache.writeQuery({ query: SettingsScreenDocument, data: meWith(cachedSats) })
  }
  return new ApolloClient({ link, cache })
}

const cachedSats = (client: ApolloClient<object>) =>
  client.readQuery<SettingsScreenQuery>({ query: SettingsScreenDocument })?.me
    ?.defaultAccount.wallets[0]?.balance

type Props = { client: ApolloClient<object>; isEnabled: boolean }

/** The client the provider hands down; the wrapper gets no props of its own, so a test
 *  switches it here before re-rendering. */
let currentClient: ApolloClient<object>

const ClientWrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <ApolloProvider client={currentClient}>{children}</ApolloProvider>
)

const renderRead = ({ client, isEnabled }: Props) => {
  currentClient = client
  const rendered = renderHook(
    ({ enabled }: { enabled: boolean }) => useFreshAccountRead(enabled),
    { initialProps: { enabled: isEnabled }, wrapper: ClientWrapper },
  )
  const rerender = (next: Props) => {
    currentClient = next.client
    rendered.rerender({ enabled: next.isEnabled })
  }
  return { result: rendered.result, rerender }
}

describe("useFreshAccountRead", () => {
  it("is idle while disabled, and reads nothing", async () => {
    const network = makeNetwork()
    const client = makeClient(network.link, 6_000_000)

    const { result } = renderRead({ client, isEnabled: false })
    await act(async () => {})

    expect(result.current).toBe(FreshAccountRead.Idle)
    expect(network.requests()).toBe(0)
  })

  /** The cache holds a balance the network no longer reports: the read stays out until
   *  the network itself answers, and its answer lands in the cache for every reader. */
  it("is pending while the network is out, then confirmed with the answer in the cache", async () => {
    const network = makeNetwork()
    const client = makeClient(network.link, 6_000_000)
    const { result } = renderRead({ client, isEnabled: true })
    await act(async () => {})
    expect(result.current).toBe(FreshAccountRead.Pending)

    await network.answer({ data: meWith(100_000) })

    expect(result.current).toBe(FreshAccountRead.Confirmed)
    expect(cachedSats(client)).toBe(100_000)
  })

  /** Another query writing the cache while the read is out says nothing about whether
   *  the network answered this one. */
  it("stays pending while other writes land in the cache", async () => {
    const network = makeNetwork()
    const client = makeClient(network.link, 6_000_000)
    const { result } = renderRead({ client, isEnabled: true })
    await act(async () => {})

    await act(async () => {
      client.cache.modify({ id: "User:user-1", fields: { language: () => "es" } })
    })

    expect(result.current).toBe(FreshAccountRead.Pending)
  })

  it("fails when the network does, and stays failed when the cache is written again", async () => {
    const network = makeNetwork()
    const client = makeClient(network.link, 6_000_000)
    const { result } = renderRead({ client, isEnabled: true })
    await act(async () => {})

    await network.answer({ fails: true })
    expect(result.current).toBe(FreshAccountRead.Failed)

    await act(async () => {
      client.cache.modify({ id: "User:user-1", fields: { language: () => "es" } })
    })

    expect(result.current).toBe(FreshAccountRead.Failed)
    expect(cachedSats(client)).toBe(6_000_000)
  })

  it("fails when the network answers with an error", async () => {
    const network = makeNetwork()
    const client = makeClient(network.link, 6_000_000)
    const { result } = renderRead({ client, isEnabled: true })
    await act(async () => {})

    await network.answer({ errors: ["Not authorized"] })

    expect(result.current).toBe(FreshAccountRead.Failed)
  })

  /** A fresh login is a new session, read anew; nothing of the last one carries over. */
  it("reads again, pending, when enabled again for a new session", async () => {
    const network = makeNetwork()
    const client = makeClient(network.link, 6_000_000)
    const { result, rerender } = renderRead({ client, isEnabled: true })
    await act(async () => {})
    await network.answer({ data: meWith(100_000) })
    expect(result.current).toBe(FreshAccountRead.Confirmed)

    rerender({ client, isEnabled: false })
    await act(async () => {})
    expect(result.current).toBe(FreshAccountRead.Idle)
    rerender({ client, isEnabled: true })

    expect(result.current).toBe(FreshAccountRead.Pending)
    await act(async () => {})
    expect(network.requests()).toBe(1)
  })

  /** Another account brings its own client: the last client's status says nothing about
   *  it, and an answer the last client gets late is not taken for this one. */
  it("starts over, pending, for a new client, and ignores the last client's late answer", async () => {
    const firstNetwork = makeNetwork()
    const firstClient = makeClient(firstNetwork.link, 6_000_000)
    const secondNetwork = makeNetwork()
    const secondClient = makeClient(secondNetwork.link, 6_000_000)
    const { result, rerender } = renderRead({ client: firstClient, isEnabled: true })
    await act(async () => {})

    rerender({ client: secondClient, isEnabled: true })
    await act(async () => {})
    expect(result.current).toBe(FreshAccountRead.Pending)

    await firstNetwork.answer({ data: meWith(100_000) })
    expect(result.current).toBe(FreshAccountRead.Pending)

    await secondNetwork.answer({ data: meWith(200_000) })
    expect(result.current).toBe(FreshAccountRead.Confirmed)
  })

  it("ignores an answer that lands after the read was disabled", async () => {
    const network = makeNetwork()
    const client = makeClient(network.link, 6_000_000)
    const { result, rerender } = renderRead({ client, isEnabled: true })
    await act(async () => {})

    rerender({ client, isEnabled: false })
    await act(async () => {})
    await network.answer({ fails: true })

    expect(result.current).toBe(FreshAccountRead.Idle)
  })
})
