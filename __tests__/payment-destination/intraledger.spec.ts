// sort-imports-ignore

import { WalletCurrency } from "@app/graphql/generated"
import {
  PaymentDetail,
  CreateIntraledgerPaymentDetailsParams,
} from "@app/screens/send-bitcoin-screen/payment-details"

const mockCreateIntraledgerPaymentDetail = jest.fn<
  PaymentDetail<WalletCurrency>,
  [CreateIntraledgerPaymentDetailsParams<WalletCurrency>]
>()

jest.mock("@app/screens/send-bitcoin-screen/payment-details", () => {
  return {
    createIntraledgerPaymentDetails: mockCreateIntraledgerPaymentDetail,
  }
})
import {
  createIntraLedgerDestination,
  resolveIntraledgerDestination,
} from "@app/screens/send-bitcoin-screen/payment-destination"
import { defaultPaymentDetailParams } from "./helpers"
import { InvalidDestinationReason } from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import { ZeroBtcMoneyAmount } from "@app/types/amounts"

describe("resolve intraledger", () => {
  const defaultIntraledgerParams = {
    parsedIntraledgerDestination: {
      paymentType: "intraledger",
      handle: "testhandle",
      valid: true,
    } as const,
    accountDefaultWalletQuery: jest.fn(),
    myWalletIds: ["testwalletid"],
  }

  it("returns invalid destination if wallet is not found", async () => {
    defaultIntraledgerParams.accountDefaultWalletQuery.mockResolvedValue({ data: {} })
    const destination = await resolveIntraledgerDestination(defaultIntraledgerParams)

    expect(destination).toEqual({
      valid: false,
      invalidReason: InvalidDestinationReason.UsernameDoesNotExist,
      invalidPaymentDestination: defaultIntraledgerParams.parsedIntraledgerDestination,
    })
  })

  describe("when the lookup itself cannot be made", () => {
    /**
     * Telling a sender that a real payee does not exist is the worst thing this screen
     * can do: it sends them to correct a spelling that was right, or to give up on a
     * payment that would have gone through. A backend that did not answer is not an
     * answer about the name.
     */
    it("reports a transport failure as unverifiable, not as a missing user", async () => {
      defaultIntraledgerParams.accountDefaultWalletQuery.mockResolvedValue({
        data: undefined,
        error: new Error("Network request failed"),
      })

      const destination = await resolveIntraledgerDestination(defaultIntraledgerParams)

      expect(destination).toEqual({
        valid: false,
        invalidReason: InvalidDestinationReason.DestinationUnverifiable,
        invalidPaymentDestination: defaultIntraledgerParams.parsedIntraledgerDestination,
      })
    })

    it("reports a thrown lookup as unverifiable too", async () => {
      // Whatever went wrong, nothing was learned about the name.
      defaultIntraledgerParams.accountDefaultWalletQuery.mockRejectedValue(
        new Error("boom"),
      )

      const destination = await resolveIntraledgerDestination(defaultIntraledgerParams)

      expect(destination).toEqual(
        expect.objectContaining({
          invalidReason: InvalidDestinationReason.DestinationUnverifiable,
        }),
      )
    })

    it("still reports a missing user when the backend answered and holds none", async () => {
      // The distinction is only worth anything if the negative case survives it.
      defaultIntraledgerParams.accountDefaultWalletQuery.mockResolvedValue({
        data: { accountDefaultWallet: null },
      })

      const destination = await resolveIntraledgerDestination(defaultIntraledgerParams)

      expect(destination).toEqual(
        expect.objectContaining({
          invalidReason: InvalidDestinationReason.UsernameDoesNotExist,
        }),
      )
    })

    it("prefers the wallet it found over an error alongside it", async () => {
      // A partial response that still carries the id is an answer.
      defaultIntraledgerParams.accountDefaultWalletQuery.mockResolvedValue({
        data: { accountDefaultWallet: { id: "successwalletid" } },
        error: new Error("partial failure"),
      })

      const destination = await resolveIntraledgerDestination(defaultIntraledgerParams)

      expect(destination).toEqual(expect.objectContaining({ valid: true }))
    })
  })

  it("returns invalid destination if user is owned by self", async () => {
    defaultIntraledgerParams.accountDefaultWalletQuery.mockResolvedValue({
      data: { accountDefaultWallet: { id: "testwalletid" } },
    })
    const destination = await resolveIntraledgerDestination(defaultIntraledgerParams)
    expect(destination).toEqual({
      valid: false,
      invalidReason: InvalidDestinationReason.SelfPayment,
      invalidPaymentDestination: defaultIntraledgerParams.parsedIntraledgerDestination,
    })
  })

  it("returns a valid destination if username exists", async () => {
    defaultIntraledgerParams.accountDefaultWalletQuery.mockResolvedValue({
      data: { accountDefaultWallet: { id: "successwalletid" } },
    })
    const destination = await resolveIntraledgerDestination(defaultIntraledgerParams)
    expect(destination).toEqual(
      expect.objectContaining({
        valid: true,
        validDestination: {
          ...defaultIntraledgerParams.parsedIntraledgerDestination,
          walletId: "successwalletid",
          valid: true,
        },
      }),
    )
  })
})

describe("create intraledger destination", () => {
  const createIntraLedgerDestinationParams = {
    parsedIntraledgerDestination: {
      paymentType: "intraledger",
      handle: "testhandle",
      valid: true,
    },
    walletId: "testwalletid",
  } as const

  it("correctly creates payment detail", () => {
    const intraLedgerDestination = createIntraLedgerDestination(
      createIntraLedgerDestinationParams,
    )
    intraLedgerDestination.createPaymentDetail(defaultPaymentDetailParams)

    expect(mockCreateIntraledgerPaymentDetail).toBeCalledWith({
      handle: createIntraLedgerDestinationParams.parsedIntraledgerDestination.handle,
      recipientWalletId: createIntraLedgerDestinationParams.walletId,
      sendingWalletDescriptor: defaultPaymentDetailParams.sendingWalletDescriptor,
      convertMoneyAmount: defaultPaymentDetailParams.convertMoneyAmount,
      unitOfAccountAmount: ZeroBtcMoneyAmount,
    })
  })
})
