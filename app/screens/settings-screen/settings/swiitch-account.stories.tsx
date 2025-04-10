import * as React from "react"

import { MockedProvider, MockedResponse } from "@apollo/client/testing"
import { createCache } from "../../../graphql/cache"
import { IsAuthedContextProvider } from "../../../graphql/is-authed-context"
import { SwitchAccount } from "./switch-account"

export const SwitchAccountComponent = ({ mock }: { mock: MockedResponse[] }) => (
  <MockedProvider mocks={mock} cache={createCache()}>
    <IsAuthedContextProvider value={true}>
      <SwitchAccount />
    </IsAuthedContextProvider>
  </MockedProvider>
)
