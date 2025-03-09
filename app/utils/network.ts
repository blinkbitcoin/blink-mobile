import { saveString, loadString, remove } from "./storage"

import type { INetwork } from "../types/network"
import { scriptHostname } from "./helper"

export const NETWORK_STRING = "NETWORK_STRING"

const GRAPHQL_REGTEST_URI = `http://${scriptHostname()}:4002/graphql`
const GRAPHQL_TESTNET_URI = "https://api.staging.galoy.io/graphql"
const GRAPHQL_MAINNET_URI = "https://api.mainnet.bitcoinjungle.app/graphql"

const GRAPHQL_REGTEST_WS_URI = `ws://${scriptHostname()}:4002/graphql`
const GRAPHQL_TESTNET_WS_URI = "wss://api.staging.galoy.io/graphql"
const GRAPHQL_MAINNET_WS_URI = "wss://api.mainnet.bitcoinjungle.app/graphql"

const OTC_PROD_BASE_URI = "https://cr.bullbitcoin.com/"
const OTC_DEV_BASE_URI = `https://cr.bullbitcoin.dev/`

// FIXME: no longer need since we switch from mst-gql to apollo-client

// this is stored independantly of Rootstore because
// the URI / server need to be set when creating the
// rootStore. therefore we are loading this before
// loading the main RootStore file

export const loadNetwork = async (): Promise<INetwork> => {
  let network = await loadString(NETWORK_STRING)

  if (!network) {
    network = __DEV__ ? "testnet" : "mainnet"
  }

  network = "mainnet"

  return network as INetwork
}

export const saveNetwork = async (network: INetwork): Promise<boolean> =>
  saveString(NETWORK_STRING, network)

export const removeNetwork = async (): Promise<void> => {
  remove(NETWORK_STRING)
}

export const getOtcBaseUri = () => {
  if(__DEV__) {
    return {
      url: OTC_DEV_BASE_URI,
      username: 'bbadmin',
      password: 'We are staging 02!',
    }
  }

  return {
    url: OTC_PROD_BASE_URI,
    username: 'bbadmin',
    password: '20b45614-60f7-46c9-9565-c9936fbc4c99',
  }
}

export const getGraphQLUri = (
  network: INetwork,
): Record<"GRAPHQL_URI" | "GRAPHQL_WS_URI", string> => {
  switch (network) {
    case "regtest":
      return { GRAPHQL_URI: GRAPHQL_REGTEST_URI, GRAPHQL_WS_URI: GRAPHQL_REGTEST_WS_URI }
    case "testnet":
      return { GRAPHQL_URI: GRAPHQL_TESTNET_URI, GRAPHQL_WS_URI: GRAPHQL_TESTNET_WS_URI }
    case "mainnet":
      return { GRAPHQL_URI: GRAPHQL_MAINNET_URI, GRAPHQL_WS_URI: GRAPHQL_MAINNET_WS_URI }
  }
}
