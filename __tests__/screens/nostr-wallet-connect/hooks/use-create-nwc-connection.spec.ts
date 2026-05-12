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
        nwcUri: "nostr+walletconnect://request",
        alias: "Amethyst",
        appName: "Amethyst",
        appPubkey: "a".repeat(64),
        permissions: ["GET_INFO", "PAY_INVOICE"],
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
})
