import * as React from "react"
import { MockedProvider } from "@apollo/client/testing"

import { createCache } from "../../../../graphql/cache"
import { IsAuthedContextProvider } from "../../../../graphql/is-authed-context"
import { SwitchAccount } from "./switch-account"

export const SwitchAccountComponent = () => (
  <MockedProvider cache={createCache()}>
    <IsAuthedContextProvider value={true}>
      <SwitchAccount />
    </IsAuthedContextProvider>
  </MockedProvider>
)
