import React from "react"

import { MockedProvider } from "@apollo/client/testing"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Meta } from "@storybook/react"

import { StoryScreen } from "../../../.storybook/views"
import { createCache } from "../../graphql/cache"
import { IsAuthedContextProvider } from "../../graphql/is-authed-context"
import { RootStackParamList } from "../../navigation/stack-param-lists"
import { SuggestionModal } from "./suggestion-modal"

export default {
  title: "SuggestionModal",
  component: SuggestionModal,
  decorators: [(Story) => <StoryScreen>{Story()}</StoryScreen>],
} as Meta<typeof SuggestionModal>

const navigationMock: NativeStackNavigationProp<RootStackParamList> = {
  popToTop: () => {},
} as NativeStackNavigationProp<RootStackParamList>

const params = {
  navigation: navigationMock,
  showSuggestionModal: true,
  setShowSuggestionModal: () => {},
} as const

export const Default = () => (
  <MockedProvider mocks={[]} cache={createCache()}>
    <IsAuthedContextProvider value={true}>
      <SuggestionModal {...params} />
    </IsAuthedContextProvider>
  </MockedProvider>
)
