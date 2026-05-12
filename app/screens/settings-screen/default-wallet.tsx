import * as React from "react"
import { View, TouchableOpacity } from "react-native"

import { gql } from "@apollo/client"
import { Divider, Text, makeStyles, useTheme, ListItem, Icon } from "@rn-vui/themed"

import { GaloyInfo } from "@app/components/atomic/galoy-info"
import {
  useAccountUpdateDefaultWalletIdMutation,
  useSetDefaultWalletScreenQuery,
  WalletCurrency,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  getSelfCustodialDefaultCurrency,
  withSelfCustodialDefaultCurrency,
} from "@app/store/persistent-state/self-custodial-default-currency"
import { AccountType } from "@app/types/wallet"

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

type WalletOption = {
  key: string
  name: string
  isSelected: boolean
  onSelect: () => void
}

type DefaultWalletPickerProps = {
  options: ReadonlyArray<WalletOption>
  info: string
}

const DefaultWalletPicker: React.FC<DefaultWalletPickerProps> = ({ options, info }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <>
      <View style={styles.walletsContainer}>
        {options.map((option, index) => {
          const isLast = index === options.length - 1
          return (
            <React.Fragment key={option.key}>
              <Divider color={colors.grey4} />
              <TouchableOpacity
                onPress={option.onSelect}
                activeOpacity={0.7}
                {...testProps(option.name)}
              >
                <ListItem containerStyle={styles.listItemContainer}>
                  <View>
                    {option.isSelected ? (
                      <Icon
                        name="checkmark-circle"
                        size={20}
                        color={colors._green}
                        type="ionicon"
                      />
                    ) : (
                      <View style={styles.listSeparator} />
                    )}
                  </View>
                  <ListItem.Content>
                    <ListItem.Title style={styles.itemTitle}>
                      <Text type="p2">{option.name}</Text>
                    </ListItem.Title>
                  </ListItem.Content>
                </ListItem>
              </TouchableOpacity>
              {isLast && <Divider color={colors.grey4} />}
            </React.Fragment>
          )
        })}
      </View>
      <View style={styles.containerInfo}>
        <GaloyInfo>{info}</GaloyInfo>
      </View>
    </>
  )
}

const CustodialDefaultWallet: React.FC = () => {
  const { LL } = useI18nContext()
  const isAuthed = useIsAuthed()

  const [newDefaultWalletId, setNewDefaultWalletId] = React.useState("")

  const { data } = useSetDefaultWalletScreenQuery({
    fetchPolicy: "cache-first",
    skip: !isAuthed,
  })

  const btcWalletId = getBtcWallet(data?.me?.defaultAccount?.wallets)?.id
  const usdWalletId = getUsdWallet(data?.me?.defaultAccount?.wallets)?.id
  const defaultWalletId = data?.me?.defaultAccount?.defaultWalletId

  const [accountUpdateDefaultWallet, { loading }] =
    useAccountUpdateDefaultWalletIdMutation()

  if (!usdWalletId || !btcWalletId) {
    return <Text>{"missing walletIds"}</Text>
  }

  const handleSetDefaultWallet = async (id: string) => {
    if (loading || id === defaultWalletId) return
    await accountUpdateDefaultWallet({ variables: { input: { walletId: id } } })
    setNewDefaultWalletId(id)
  }

  const selectedWalletId = newDefaultWalletId || defaultWalletId || ""

  const options: ReadonlyArray<WalletOption> = [
    {
      key: btcWalletId,
      name: LL.common.bitcoin(),
      isSelected: selectedWalletId === btcWalletId,
      onSelect: () => handleSetDefaultWallet(btcWalletId),
    },
    {
      key: usdWalletId,
      name: LL.common.dollarStablesats(),
      isSelected: selectedWalletId === usdWalletId,
      onSelect: () => handleSetDefaultWallet(usdWalletId),
    },
  ]

  return <DefaultWalletPicker options={options} info={LL.DefaultWalletScreen.info()} />
}

const SelfCustodialDefaultWallet: React.FC = () => {
  const { LL } = useI18nContext()
  const { persistentState, updateState } = usePersistentStateContext()

  const selectedCurrency = getSelfCustodialDefaultCurrency(persistentState)

  const setCurrency = (currency: "BTC" | "USD") => {
    updateState((prev) => prev && withSelfCustodialDefaultCurrency(prev, currency))
  }

  const options: ReadonlyArray<WalletOption> = [
    {
      key: WalletCurrency.Btc,
      name: LL.common.bitcoin(),
      isSelected: selectedCurrency === WalletCurrency.Btc,
      onSelect: () => setCurrency(WalletCurrency.Btc),
    },
    {
      key: WalletCurrency.Usd,
      name: LL.common.dollarStablecoin(),
      isSelected: selectedCurrency === WalletCurrency.Usd,
      onSelect: () => setCurrency(WalletCurrency.Usd),
    },
  ]

  return (
    <DefaultWalletPicker
      options={options}
      info={LL.DefaultWalletScreen.infoSelfCustodial()}
    />
  )
}

export const DefaultWalletScreen: React.FC = () => {
  const { activeAccount } = useAccountRegistry()
  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial

  return (
    <Screen preset="scroll">
      {isSelfCustodial ? <SelfCustodialDefaultWallet /> : <CustodialDefaultWallet />}
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
    marginTop: 34,
    marginBottom: 32,
  },
  listSeparator: {
    width: 20,
    height: 20,
  },
}))
