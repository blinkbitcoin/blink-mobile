import React from "react"

import { MockedProvider } from "@apollo/client/testing"
import { ZeroBtcMoneyAmount } from "@app/types/amounts"
import { PaymentType } from "@blinkbitcoin/blink-client"
import { Meta } from "@storybook/react"

import { StoryScreen } from "../../../.storybook/views"
import { createCache } from "../../graphql/cache"
import { IsAuthedContextProvider } from "../../graphql/is-authed-context"
import mocks from "../../graphql/mocks"
import {
  DestinationDirection,
  PaymentDestination,
  ResolvedIntraledgerPaymentDestination,
} from "./payment-destination/index.types"
import { createIntraledgerPaymentDetails } from "./payment-details"
import SendBitcoinDetailsScreen from "./send-bitcoin-details-screen"

export default {
  title: "SendBitcoinDetailsScreen",
  component: SendBitcoinDetailsScreen,
  decorators: [
    (Story) => (
      <IsAuthedContextProvider value={true}>
        <MockedProvider mocks={mocks} cache={createCache()}>
          <StoryScreen>{Story()}</StoryScreen>
        </MockedProvider>
      </IsAuthedContextProvider>
    ),
  ],
} as Meta<typeof SendBitcoinDetailsScreen>

const walletId = "f79792e3-282b-45d4-85d5-7486d020def5"
const handle = "test"

const validDestination: ResolvedIntraledgerPaymentDestination = {
  valid: true,
  walletId,
  paymentType: PaymentType.Intraledger,
  handle,
}

/* eslint @typescript-eslint/ban-ts-comment: "off" */
// @ts-ignore-next-line no-implicit-any error
const createPaymentDetail = ({ convertMoneyAmount, sendingWalletDescriptor }) => {
  return createIntraledgerPaymentDetails({
    handle,
    recipientWalletId: walletId,
    sendingWalletDescriptor,
    convertMoneyAmount,
    unitOfAccountAmount: ZeroBtcMoneyAmount,
  })
}

const paymentDestination: PaymentDestination = {
  valid: true,
  validDestination,
  destinationDirection: DestinationDirection.Send,
  // @ts-ignore-next-line no-implicit-any error
  createPaymentDetail,
}

const route = {
  key: "sendBitcoinDetailsScreen",
  name: "sendBitcoinDetails",
  params: {
    paymentDestination,
  },
} as const

export const Intraledger = () => <SendBitcoinDetailsScreen route={route} />
