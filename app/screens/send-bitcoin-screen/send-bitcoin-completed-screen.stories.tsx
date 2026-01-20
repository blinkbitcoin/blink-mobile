import * as React from "react"

import { MockedProvider } from "@apollo/client/testing"
import { Meta } from "@storybook/react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { RouteProp } from "@react-navigation/native"

import { StoryScreen } from "../../../.storybook/views"
import { createCache } from "../../graphql/cache"
import { IsAuthedContextProvider } from "../../graphql/is-authed-context"
import SendBitcoinCompletedScreen from "./send-bitcoin-completed-screen"

export default {
  title: "Send Bitcoin Completed Screen",
  component: SendBitcoinCompletedScreen,
  decorators: [(Story) => <StoryScreen>{Story()}</StoryScreen>],
} as Meta<typeof SendBitcoinCompletedScreen>

const successRoute = {
  key: "sendBitcoinCompleted",
  name: "sendBitcoinCompleted",
  params: {
    status: "SUCCESS",
    arrivalAtMempoolEstimate: undefined,
  },
} as const

export const Success = () => (
  <MockedProvider mocks={[]} cache={createCache()}>
    <IsAuthedContextProvider value={true}>
      <SendBitcoinCompletedScreen route={successRoute} />
    </IsAuthedContextProvider>
  </MockedProvider>
)

const queuedRoute = {
  key: "sendBitcoinCompleted",
  name: "sendBitcoinCompleted",
  params: {
    status: "PENDING",
    arrivalAtMempoolEstimate: 10000,
  },
} as const

export const Queued = () => (
  <MockedProvider mocks={[]} cache={createCache()}>
    <IsAuthedContextProvider value={true}>
      <SendBitcoinCompletedScreen route={queuedRoute} />
    </IsAuthedContextProvider>
  </MockedProvider>
)

const pendingRoute = {
  key: "sendBitcoinCompleted",
  name: "sendBitcoinCompleted",
  params: {
    status: "PENDING",
    arrivalAtMempoolEstimate: undefined,
  },
} as const

export const Pending = () => (
  <MockedProvider mocks={[]} cache={createCache()}>
    <IsAuthedContextProvider value={true}>
      <SendBitcoinCompletedScreen route={pendingRoute} />
    </IsAuthedContextProvider>
  </MockedProvider>
)

export const SuccessAction = ({
  route,
}: {
  route: RouteProp<RootStackParamList, "sendBitcoinCompleted">
}) => (
  <MockedProvider mocks={[]} cache={createCache()}>
    <IsAuthedContextProvider value={true}>
      <SendBitcoinCompletedScreen route={route} />
    </IsAuthedContextProvider>
  </MockedProvider>
)
