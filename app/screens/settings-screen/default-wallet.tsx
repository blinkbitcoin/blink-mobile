import * as React from "react"
import { View, Image, TouchableOpacity } from "react-native"

import { gql } from "@apollo/client"
import {
  useAccountUpdateDefaultWalletIdMutation,
  useSetDefaultWalletScreenQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import { useI18nContext } from "@app/i18n/i18n-react"
import { Divider, Text, makeStyles, useTheme, ListItem, Icon } from "@rn-vui/themed"

import { Screen } from "../../components/screen"
import { testProps } from "../../utils/testProps"

gql`
  mutation accountUpdateDefaultWalletId($input: AccountUpdateDefaultWalletIdInput!) {
    accountUpdateDefaultWalletId(input: $input) {
      errors {
        message
      }
      account {
        id
        defaultWalletId
      }
    }
  }

  query setDefaultWalletScreen {
    me {
      id
      defaultAccount {
        id
        defaultWalletId
        wallets {
          id
          balance
          walletCurrency
        }
      }
    }
  }
`

export const DefaultWalletScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const isAuthed = useIsAuthed()

  const [newDefaultWalletId, setNewDefaultWalletId] = React.useState("")

  const { data } = useSetDefaultWalletScreenQuery({
    fetchPolicy: "cache-first",
    skip: !isAuthed,
  })

  const btcWallet = getBtcWallet(data?.me?.defaultAccount?.wallets)
  const usdWallet = getUsdWallet(data?.me?.defaultAccount?.wallets)

  const btcWalletId = btcWallet?.id
  const usdWalletId = usdWallet?.id

  const defaultWalletId = data?.me?.defaultAccount?.defaultWalletId

  const [accountUpdateDefaultWallet, { loading }] =
    useAccountUpdateDefaultWalletIdMutation()

  if (!usdWalletId || !btcWalletId) {
    return <Text>{"missing walletIds"}</Text>
  }

  const handleSetDefaultWallet = async (id: string) => {
    if (loading) return
    if (id !== defaultWalletId) {
      await accountUpdateDefaultWallet({
        variables: {
          input: {
            walletId: id,
          },
        },
      })
      setNewDefaultWalletId(id)
    }
  }

  const Wallets = [
    {
      name: "Bitcoin",
      id: btcWalletId,
    },
    {
      name: "Stablesats (USD)",
      id: usdWalletId,
    },
  ] as const

  const selectedWalletId = newDefaultWalletId || defaultWalletId || ""

  return (
    <Screen preset="scroll">
      <View style={styles.walletsContainer}>
        {Wallets.map(({ name, id }, index) => {
          const isLast = index === Wallets.length - 1
          const isSelected = selectedWalletId === id
          return (
            <React.Fragment key={id}>
              <Divider color={colors.grey4} />
              <TouchableOpacity
                onPress={() => handleSetDefaultWallet(id)}
                activeOpacity={0.7}
                {...testProps(name)}
              >
                <ListItem containerStyle={styles.listItemContainer}>
                  <View>
                    {isSelected ? (
                      <Icon
                        name="checkmark-circle"
                        size={20}
                        color={colors._green}
                        type="ionicon"
                      />
                    ) : (
                      <View style={{ width: 20, height: 20 }}></View>
                    )}
                  </View>
                  <ListItem.Content>
                    <ListItem.Title style={styles.itemTitle}>
                      <Text type="p2">{name}</Text>
                    </ListItem.Title>
                  </ListItem.Content>
                </ListItem>
              </TouchableOpacity>
              {isLast && <Divider color={colors.grey4} />}
            </React.Fragment>
          )
        })}
      </View>

      <View style={styles.chartsContainer}>
        <View style={styles.chartItem}>
          <Text type="p2" style={styles.chartLabel}>
            Bitcoin
          </Text>
          <Image
            source={require("@app/assets/images/bitcoin-chart.png")}
            style={styles.chartImage}
            resizeMode="stretch"
          />
        </View>

        <View style={styles.chartItem}>
          <Text type="p2" style={styles.chartLabel}>
            Stablesats
          </Text>
          <Image
            source={require("@app/assets/images/stablesats-chart.png")}
            style={styles.chartImage}
            resizeMode="contain"
          />
        </View>
      </View>

      <View style={styles.containerInfo}>
        <View style={[styles.infoBox, { backgroundColor: colors.grey5 }]}>
          <Text type="p3" style={styles.infoText}>
            Use your Stablesats account in Blink to keep the money in your wallet stable
            in fiat (dollar) terms. Use your Bitcoin account if you're stacking sats and
            are okay with your fiat balance changing all the time.
          </Text>
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  walletsContainer: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  listItemContainer: {
    backgroundColor: colors.transparent,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  itemTitle: {
    fontSize: 16,
  },
  containerInfo: {
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 32,
  },
  chartsContainer: {
    marginTop: 32,
    marginHorizontal: 20,
    gap: 32,
  },
  chartItem: {
    gap: 12,
    position: "relative",
  },
  chartLabel: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  chartImage: {
    width: "100%",
    height: 100,
  },
  infoBox: {
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.grey3,
  },
  infoText: {
    lineHeight: 20,
  },
}))
