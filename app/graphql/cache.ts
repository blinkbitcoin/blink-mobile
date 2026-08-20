import { InMemoryCache, gql } from "@apollo/client"
import { relayStylePagination } from "@apollo/client/utilities"

gql`
  query realtimePrice {
    me {
      id
      defaultAccount {
        id
        realtimePrice {
          btcSatPrice {
            base
            offset
          }
          denominatorCurrency
          id
          timestamp
          usdCentPrice {
            base
            offset
          }
        }
      }
    }
  }

  query realtimePriceUnauthed($currency: DisplayCurrency) {
    realtimePrice(currency: $currency) {
      btcSatPrice {
        base
        offset
      }
      denominatorCurrency
      id
      timestamp
      usdCentPrice {
        base
        offset
      }
    }
  }
`

export const createCache = () =>
  new InMemoryCache({
    possibleTypes: {
      // TODO: add other possible types
      Account: ["ConsumerAccount"],
    },
    typePolicies: {
      Globals: {
        // singleton: only cache latest version:
        // https://www.apollographql.com/docs/react/caching/cache-configuration/#customizing-cache-ids
        keyFields: [],
      },
      RealtimePrice: {
        keyFields: [],
      },
      Contact: {
        fields: {
          prettyName: {
            read(_, { readField }) {
              return readField("id") || readField("name")
            },
          },
        },
      },
      UserContact: {
        fields: {
          transactions: relayStylePagination(),
        },
      },
      Earn: {
        fields: {
          completed: {
            read: (value) => value ?? false,
          },
        },
      },
      TxLastSeen: {
        keyFields: ["accountId"],
      },
      Query: {
        fields: {
          // local only fields
          // Legacy: the setting lives in PersistentState now, this is read once on
          // upgrade so users who set it on an older build keep it.
          hideBalance: {
            read: (value) => value ?? false,
          },
          beta: {
            read: (value) => value ?? false,
          },
          countryCode: {
            read: (value) => value ?? "SV",
          },
          region: {
            read: (value) => value ?? null,
          },
          introducingCirclesModalShown: {
            read: (value) => value ?? false,
          },
          innerCircleValue: {
            read: (value) => value ?? -1,
          },
          upgradeModalLastShownAt: {
            read: (value) => value ?? null,
          },
          preferredAmountCurrency: {
            read: (value) => value ?? null,
          },
          deviceSessionCount: {
            read: (value) => value ?? 0,
          },
          cardTransactionsPaginated: relayStylePagination(["cardId"]),
          txLastSeen: {
            keyArgs: ["accountId"],
            read(value, { args }) {
              if (value) return value
              return {
                __typename: "TxLastSeen",
                accountId: args?.accountId || "",
                btcId: "",
                usdId: "",
              }
            },
          },
        },
      },
      Wallet: {
        fields: {
          transactions: relayStylePagination(),
        },
      },
      Account: {
        fields: {
          transactions: relayStylePagination(["walletIds"]),
        },
      },
    },
  })
