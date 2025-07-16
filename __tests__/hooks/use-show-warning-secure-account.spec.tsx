import * as React from "react"
import { PropsWithChildren } from "react"
import { act } from "react-test-renderer"

import { MockedProvider } from "@apollo/client/testing"
import {
  CurrencyListDocument,
  RealtimePriceDocument,
  WarningSecureAccountDocument,
} from "@app/graphql/generated"
import { IsAuthedContextProvider } from "@app/graphql/is-authed-context"
import { useShowWarningSecureAccount } from "@app/screens/settings-screen/account/show-warning-secure-account-hook"
import { renderHook } from "@testing-library/react-hooks"

// FIXME: the mockPrice doesn't work as expect.
// it's ok because we have more than $5 in the dollar wallet
const mocksPrice = [
  {
    request: {
      query: RealtimePriceDocument,
    },
    result: {
      data: {
        me: {
          __typename: "User",
          id: "70df9822-efe0-419c-b864-c9efa99872ea",
          defaultAccount: {
            __typename: "Account",
            id: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
            realtimePrice: {
              btcSatPrice: {
                base: 24015009766,
                offset: 12,
                currencyUnit: "USDCENT",
                __typename: "PriceOfOneSat",
              },
              denominatorCurrency: "USD",
              id: "67b6e1d2-04c8-509a-abbd-b1cab08575d5",
              timestamp: 1677184189,
              usdCentPrice: {
                base: 100000000,
                offset: 6,
                currencyUnit: "USDCENT",
                __typename: "PriceOfOneUsdCent",
              },
              __typename: "RealtimePrice",
            },
          },
        },
      },
    },
  },
  {
    request: {
      query: CurrencyListDocument,
    },
    result: {
      data: {
        currencyList: [
          {
            flag: "🇳🇬",
            id: "USD",
            name: "Usd dollar",
            symbol: "$",
            fractionDigits: 2,
            __typename: "Currency",
          },
        ],
      },
    },
  },
]

const mockLevelZeroLowBalance = [
  ...mocksPrice,
  {
    request: {
      query: WarningSecureAccountDocument,
    },
    result: {
      data: {
        me: {
          id: "70df9822-efe0-419c-b864-c9efa99872ea",
          language: "",
          username: "test1",
          phone: "+50365055539",
          defaultAccount: {
            level: "ZERO",
            id: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
            defaultWalletId: "f79792e3-282b-45d4-85d5-7486d020def5",
            wallets: [
              {
                id: "f79792e3-282b-45d4-85d5-7486d020def5",
                balance: 100,
                walletCurrency: "BTC",
                __typename: "BTCWallet",
              },
              {
                id: "f091c102-6277-4cc6-8d81-87ebf6aaad1b",
                balance: 100,
                walletCurrency: "USD",
                __typename: "UsdWallet",
              },
            ],
            __typename: "ConsumerAccount",
          },
          __typename: "User",
        },
      },
    },
  },
]

const mockLevelZeroHighBalance = [
  ...mocksPrice,
  {
    request: {
      query: WarningSecureAccountDocument,
    },
    result: {
      data: {
        me: {
          id: "70df9822-efe0-419c-b864-c9efa99872ea",
          defaultAccount: {
            level: "ZERO",
            id: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
            wallets: [
              {
                id: "f79792e3-282b-45d4-85d5-7486d020def5",
                balance: 100,
                walletCurrency: "BTC",
                __typename: "BTCWallet",
              },
              {
                id: "f091c102-6277-4cc6-8d81-87ebf6aaad1b",
                balance: 600,
                walletCurrency: "USD",
                __typename: "UsdWallet",
              },
            ],
            __typename: "ConsumerAccount",
          },
          __typename: "User",
        },
      },
    },
  },
]

const mockLevelOneHighBalance = [
  ...mocksPrice,
  {
    request: {
      query: WarningSecureAccountDocument,
    },
    result: {
      data: {
        me: {
          id: "70df9822-efe0-419c-b864-c9efa99872ea",
          defaultAccount: {
            level: "ONE",
            id: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
            wallets: [
              {
                id: "f79792e3-282b-45d4-85d5-7486d020def5",
                balance: 100,
                walletCurrency: "BTC",
                __typename: "BTCWallet",
              },
              {
                id: "f091c102-6277-4cc6-8d81-87ebf6aaad1b",
                balance: 600,
                walletCurrency: "USD",
                __typename: "UsdWallet",
              },
            ],
            __typename: "ConsumerAccount",
          },
          __typename: "User",
        },
      },
    },
  },
]

/* eslint-disable react/display-name */
/* eslint @typescript-eslint/ban-ts-comment: "off" */
export const wrapWithCache =
  // @ts-ignore-next-line no-implicit-any error

  (mocks) =>
    ({ children }: PropsWithChildren) => {
      return (
        <IsAuthedContextProvider value={true}>
          <MockedProvider mocks={mocks}>{children}</MockedProvider>
        </IsAuthedContextProvider>
      )
    }

describe("useShowWarningSecureAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("return false with level 0 and no balance", async () => {
    const { result } = renderHook(useShowWarningSecureAccount, {
      wrapper: wrapWithCache(mockLevelZeroLowBalance),
    })

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )
    expect(result.current).toBe(false)
  })

  it("return true with level 0 and more than $5 balance", async () => {
    const { result, unmount } = renderHook(useShowWarningSecureAccount, {
      wrapper: wrapWithCache(mockLevelZeroHighBalance),
    })

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )
    expect(result.current).toBe(true)
    unmount()
  })

  it("return false with level 1 and more than $5 balance", async () => {
    const { result } = renderHook(useShowWarningSecureAccount, {
      wrapper: wrapWithCache(mockLevelOneHighBalance),
    })

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )
    expect(result.current).toBe(false)
  })
})
