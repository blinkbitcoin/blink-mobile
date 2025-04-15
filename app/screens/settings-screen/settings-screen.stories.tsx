import * as React from "react"

import { MockedProvider, MockedResponse } from "@apollo/client/testing"
import { Meta } from "@storybook/react"

import { StoryScreen } from "../../../.storybook/views"
import { createCache } from "../../graphql/cache"
import { SettingsScreenDocument } from "../../graphql/generated"
import { IsAuthedContextProvider } from "../../graphql/is-authed-context"
import { SettingsScreen } from "./settings-screen"

const mocksNoUsername = [
  {
    request: {
      query: SettingsScreenDocument,
    },
    result: {
      data: {
        me: {
          id: "70df9822-efe0-419c-b864-c9efa99872ea",
          phone: "+50365055539",
          username: "",
          language: "",
          defaultAccount: {
            id: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
            displayCurrency: "EUR",
            defaultWalletId: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
            __typename: "ConsumerAccount",
          },
          __typename: "User",
        },
      },
    },
  },
]

export default {
  title: "Settings Screen",
  component: SettingsScreen,
  decorators: [(Story) => <StoryScreen>{Story()}</StoryScreen>],
} as Meta<typeof SettingsScreen>

export const NotLoggedIn = () => (
  <MockedProvider cache={createCache()}>
    <IsAuthedContextProvider value={false}>
      <SettingsScreen />
    </IsAuthedContextProvider>
  </MockedProvider>
)

export const LoggedInNoUsername = () => (
  <MockedProvider mocks={mocksNoUsername} cache={createCache()}>
    <IsAuthedContextProvider value={true}>
      <SettingsScreen />
    </IsAuthedContextProvider>
  </MockedProvider>
)

export const LoggedInWithUsername = ({ mock }: { mock: MockedResponse[] }) => (
  <MockedProvider mocks={mock} cache={createCache()}>
    <IsAuthedContextProvider value={true}>
      <SettingsScreen />
    </IsAuthedContextProvider>
  </MockedProvider>
)
