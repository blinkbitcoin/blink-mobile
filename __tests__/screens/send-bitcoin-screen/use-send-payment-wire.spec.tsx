import { renderHook, act } from "@testing-library/react-native"
import React from "react"
import Crypto from "react-native-quick-crypto"

import {
  ApolloClient,
  ApolloLink,
  ApolloProvider,
  InMemoryCache,
  Observable,
  Operation,
} from "@apollo/client"
import { hasIdempotencyKey } from "@app/graphql/retry-policy"
import { useSendPayment } from "@app/screens/send-bitcoin-screen/use-send-payment"

/**
 * The rest of the send-payment specs assert the options object handed to the mutate
 * functions. This one runs a real ApolloClient over a capturing terminal link, because
 * the key is stamped as per-call context and only Apollo decides whether per-call context
 * reaches the operation. Without this, a merge behaving differently from what the hook
 * assumes would drop the header in production while every other spec stayed green.
 *
 * The generated module is deliberately NOT mocked here — these are the real hooks.
 */

const KEY = "11111111-1111-4111-8111-111111111111"

const captured: Operation[] = []

const capturingLink = new ApolloLink((operation) => {
  captured.push(operation)
  return Observable.of({
    data: {
      lnInvoicePaymentSend: {
        __typename: "PaymentSendPayload",
        status: "SUCCESS",
        errors: [],
      },
    },
  })
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ApolloProvider
    client={new ApolloClient({ link: capturingLink, cache: new InMemoryCache() })}
  >
    {children}
  </ApolloProvider>
)

describe("useSendPayment — idempotency header on the wire", () => {
  beforeEach(() => {
    captured.length = 0
    ;(Crypto.randomUUID as jest.Mock).mockReset()
    ;(Crypto.randomUUID as jest.Mock).mockReturnValue(KEY)
  })

  it("carries the key into the operation context, where the retry gate reads it", async () => {
    const sendPaymentMutation = async (fns: {
      lnInvoicePaymentSend: (options: unknown) => Promise<unknown>
    }) => {
      await fns.lnInvoicePaymentSend({
        variables: { input: { walletId: "w", paymentRequest: "lnbc1", memo: null } },
      })
      return { status: undefined }
    }

    const { result } = renderHook(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => useSendPayment(sendPaymentMutation as any, {}),
      { wrapper },
    )

    await act(async () => {
      await result.current.sendPayment?.()
    })

    // refetchQueries can put the HomeAuthed refetch on the same link.
    const payment = captured.find((op) => op.operationName === "lnInvoicePaymentSend")
    expect(payment).toBeDefined()
    expect(payment?.getContext().headers).toMatchObject({ "X-Idempotency-Key": KEY })
    // The real predicate that stops RetryLink resending money-moving operations.
    expect(hasIdempotencyKey(payment as Operation)).toBe(true)

    // The refetch must NOT carry the key: it is a query, and a stray idempotency header
    // would switch off its transport retries too.
    const refetch = captured.find((op) => op.operationName !== "lnInvoicePaymentSend")
    if (refetch) {
      expect(hasIdempotencyKey(refetch)).toBe(false)
    }
  })
})
