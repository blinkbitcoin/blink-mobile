import { ApolloClient, gql, makeVar } from "@apollo/client"
import indexOf from "lodash.indexof"
import analytics from "@react-native-firebase/analytics"

import type { INetwork } from "../types/network"
import { loadString } from "../utils/storage"
import { decodeToken, TOKEN_KEY } from "../utils/use-token"

export const authTokenVar = makeVar<TokenPayload | null>(null)

export const loadAuthToken = async (): Promise<void> => {
  let uid: string
  let network: INetwork
  const token: string | null = await loadString(TOKEN_KEY)

  if (token) {
    ;({ uid, network } = decodeToken(token))
    authTokenVar({ token, uid, network })
    analytics().setUserId(uid)
  }
}

export const networkVar = makeVar<INetwork | null>(null)

export const prefCurrencyVar = makeVar<CurrencyType>("USD")
export const modalClipboardVisibleVar = makeVar(false)

export const nextPrefCurrency = (): void => {
  const units: CurrencyType[] = ["BTC", "USD"]
  const currentIndex = indexOf(units, prefCurrencyVar())
  prefCurrencyVar(units[(currentIndex + 1) % units.length])
}

export const PRICE_CACHE = gql`
  query priceCache {
    price @client
  }
`

export const LAST_CLIPBOARD_PAYMENT = gql`
  query LastClipboardPayment {
    lastClipboardPayment @client
  }
`

export const HIDE_BALANCE = gql`
  query HideBalance {
    hideBalance @client
  }
`

export const HIDDEN_BALANCE_TOOL_TIP = gql`
  query HiddenBalanceToolTip {
    hiddenBalanceToolTip @client
  }
`

export const saveHideBalance = (
  client: ApolloClient<unknown>,
  status: boolean,
): boolean => {
  try {
    client.writeQuery({
      query: HIDE_BALANCE,
      data: {
        hideBalance: status,
      },
    })
    return status
  } catch {
    return false
  }
}

export const saveHiddenBalanceToolTip = (
  client: ApolloClient<unknown>,
  status: boolean,
): boolean => {
  try {
    client.writeQuery({
      query: HIDDEN_BALANCE_TOOL_TIP,
      data: {
        hiddenBalanceToolTip: status,
      },
    })
    return status
  } catch {
    return false
  }
}
