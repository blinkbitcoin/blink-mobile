import React, { PropsWithChildren } from "react"
import { renderHook, act } from "@testing-library/react-native"

import { useCreateNwcConnection } from "@app/screens/nostr-wallet-connect/hooks/use-create-nwc-connection"
import { NwcConnectionsProvider } from "@app/screens/nostr-wallet-connect/hooks/use-nwc-connections"

const mockMutate = jest.fn()
const mockQuery = jest.fn()

jest.mock("@apollo/client", () => ({
  useApolloClient: () => ({
    mutate: mockMutate,
    query: mockQuery,
  }),
}))

const wrapper = ({ children }: PropsWithChildren) =>
  React.createElement(NwcConnectionsProvider, undefined, children)

describe("useCreateNwcConnection", () => {
  const createInput = {
    nwcUri: "nostr+walletconnect://request",
    alias: "Amethyst",
    appName: "Amethyst",
    appPubkey: "a".repeat(64),
    permissions: ["GET_INFO", "PAY_INVOICE"] as const,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockMutate.mockResolvedValue({
      data: {
        nwcConnectionCreate: {
          errors: [],
          connectionUri: "nostr+walletconnect://created",
          connection: {
            id: "backend-connection-id",
            alias: "Amethyst",
            appPubkey: "a".repeat(64),
          },
        },
      },
    })
  })

  it("sends all selected budgets through the create mutation", async () => {
    const budgets = [
      { amountSats: 10_000, period: "DAILY" as const },
      { amountSats: 50_000, period: "MONTHLY" as const },
    ]

    const { result } = renderHook(() => useCreateNwcConnection(), { wrapper })

    await act(async () => {
      await result.current.createNwcConnection({
        ...createInput,
        budgets,
      })
    })

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: {
            nwcUri: "nostr+walletconnect://request",
            alias: "Amethyst",
            permissions: ["GET_INFO", "PAY_INVOICE"],
            budgets,
          },
        },
      }),
    )
    expect(result.current.loading).toBe(false)
  })

  it("does not retain NWC connection strings in provider state", async () => {
    const { result } = renderHook(() => useCreateNwcConnection(), { wrapper })

    let createResult: Awaited<ReturnType<typeof result.current.createNwcConnection>>

    await act(async () => {
      createResult = await result.current.createNwcConnection(createInput)
    })

    expect(createResult!.connectionUri).toBe("nostr+walletconnect://created")
    expect(createResult!.connection).not.toHaveProperty("connectionString")
  })

  it("detects duplicate app pubkeys from the latest provider state", async () => {
    const { result } = renderHook(() => useCreateNwcConnection(), { wrapper })

    await act(async () => {
      await result.current.createNwcConnection(createInput)
    })

    let duplicateResult: Awaited<ReturnType<typeof result.current.createNwcConnection>>

    await act(async () => {
      duplicateResult = await result.current.createNwcConnection({
        ...createInput,
        nwcUri: "nostr+walletconnect://duplicate-request",
      })
    })

    expect(duplicateResult!.errors[0]).toMatchObject({
      code: "DUPLICATE_CONNECTION",
      replaceable: true,
    })
    expect(mockMutate).toHaveBeenCalledTimes(1)
  })

  it("rejects a second create while the same app pubkey is already in flight", async () => {
    let resolveFirstMutation:
      | ((value: Awaited<ReturnType<typeof mockMutate>>) => void)
      | undefined

    mockMutate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstMutation = resolve
        }),
    )

    const { result } = renderHook(() => useCreateNwcConnection(), { wrapper })

    let firstCreate: ReturnType<typeof result.current.createNwcConnection>
    act(() => {
      firstCreate = result.current.createNwcConnection(createInput)
    })

    let duplicateResult: Awaited<ReturnType<typeof result.current.createNwcConnection>>
    await act(async () => {
      duplicateResult = await result.current.createNwcConnection(createInput)
    })

    expect(duplicateResult!.errors[0]).toMatchObject({
      code: "DUPLICATE_CONNECTION",
      replaceable: true,
    })
    expect(mockMutate).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFirstMutation?.({
        data: {
          nwcConnectionCreate: {
            errors: [],
            connectionUri: "nostr+walletconnect://created",
            connection: {
              id: "backend-connection-id",
              alias: "Amethyst",
              appPubkey: "a".repeat(64),
            },
          },
        },
      })
      await firstCreate!
    })
  })
})
