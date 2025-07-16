import { PropsWithChildren } from "react"
import * as React from "react"
import { act } from "react-test-renderer"

import { MockedProvider } from "@apollo/client/testing"
import { CurrencyListDocument, RealtimePriceDocument } from "@app/graphql/generated"
import { IsAuthedContextProvider } from "@app/graphql/is-authed-context"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { renderHook } from "@testing-library/react-hooks"

const mocksNgn = [
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
              denominatorCurrency: "NGN",
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
            id: "NGN",
            name: "Nigerian Naira",
            symbol: "₦",
            fractionDigits: 2,
            __typename: "Currency",
          },
        ],
      },
    },
  },
]

const mocksJpy = [
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
                __typename: "PriceOfOneSat",
              },
              denominatorCurrency: "JPY",
              id: "67b6e1d2-04c8-509a-abbd-b1cab08575d5",
              timestamp: 1677184189,
              usdCentPrice: {
                base: 100000000,
                offset: 6,
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
            flag: "",
            id: "JPY",
            name: "Japanese Yen",
            symbol: "¥",
            fractionDigits: 0,
            __typename: "Currency",
          },
        ],
      },
    },
  },
]

/* eslint-disable react/display-name */
/* eslint @typescript-eslint/ban-ts-comment: "off" */
const wrapWithMocks =
  // @ts-ignore-next-line no-implicit-any error

  (mocks) =>
    ({ children }: PropsWithChildren) => (
      <IsAuthedContextProvider value={true}>
        <MockedProvider mocks={mocks}>{children}</MockedProvider>
      </IsAuthedContextProvider>
    )

describe("usePriceConversion", () => {
  describe("testing moneyAmountToMajorUnitOrSats", () => {
    it("with 0 digits", async () => {
      const { result } = renderHook(useDisplayCurrency, {
        wrapper: wrapWithMocks(mocksJpy),
      })

      await act(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 10)
          }),
      )

      const res = result.current.moneyAmountToMajorUnitOrSats({
        amount: 100,
        currency: "DisplayCurrency",
        currencyCode: "JPY",
      })

      expect(res).toBe(100)
    })

    it("with 2 digits", async () => {
      const { result, waitForNextUpdate } = renderHook(useDisplayCurrency, {
        wrapper: wrapWithMocks(mocksNgn),
      })

      await waitForNextUpdate()

      const res = result.current.moneyAmountToMajorUnitOrSats({
        amount: 10,
        currency: "DisplayCurrency",
        currencyCode: "NGN",
      })

      expect(res).toBe(0.1)
    })
  })

  it("unAuthed should return default value", async () => {
    const { result } = renderHook(useDisplayCurrency, {
      wrapper: wrapWithMocks([]),
    })

    expect(result.current).toMatchObject({
      fractionDigits: 2,
      fiatSymbol: "$",
      displayCurrency: "USD",
    })
  })

  it("authed but empty query should return default value", async () => {
    const { result, waitForNextUpdate } = renderHook(useDisplayCurrency, {
      wrapper: wrapWithMocks([]),
    })

    expect(result.current).toMatchObject({
      fractionDigits: 2,
      fiatSymbol: "$",
      displayCurrency: "USD",
    })

    await waitForNextUpdate()

    expect(result.current).toMatchObject({
      fractionDigits: 2,
      fiatSymbol: "$",
      displayCurrency: "USD",
    })
  })

  it("authed should return NGN from mock", async () => {
    const { result, waitFor } = renderHook(useDisplayCurrency, {
      wrapper: wrapWithMocks(mocksNgn),
    })

    expect(result.current).toMatchObject({
      fractionDigits: 2,
      fiatSymbol: "$",
      displayCurrency: "USD",
    })

    // ultimately this is what we want
    // but this is failing in CI
    // await waitForNextUpdate()

    await waitFor(
      () => {
        return result.current.displayCurrency === "NGN"
      },
      {
        timeout: 4000,
      },
    )

    expect(result.current).toMatchObject({
      fractionDigits: 2,
      fiatSymbol: "₦",
      displayCurrency: "NGN",
    })
  })
})
