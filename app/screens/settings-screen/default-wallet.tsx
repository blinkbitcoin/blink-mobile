import * as React from "react"
import { View } from "react-native"

import { gql } from "@apollo/client"
import { GaloyInfo } from "@app/components/atomic/galoy-info"
import { MenuSelect, MenuSelectItem } from "@app/components/menu-select"
import {
  useAccountUpdateDefaultWalletIdMutation,
  useSetDefaultWalletScreenQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import { useI18nContext } from "@app/i18n/i18n-react"
import { Text, makeStyles } from "@rn-vui/themed"

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
      // TODO: translation
      name: "Bitcoin",
      id: btcWalletId,
    },
    {
      name: "Stablesats (USD)",
      id: usdWalletId,
    },
  ] as const

  return (
    <Screen preset="scroll">
      <MenuSelect
        value={newDefaultWalletId || defaultWalletId || ""}
        onChange={handleSetDefaultWallet}
      >
        {Wallets.map(({ name, id }) => (
          <MenuSelectItem key={id} value={id} {...testProps(name)}>
            {name}
          </MenuSelectItem>
        ))}
      </MenuSelect>
      <View style={styles.containerInfo}>
        <GaloyInfo>{LL.DefaultWalletScreen.info()}</GaloyInfo>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  containerInfo: {
    margin: 20,
  },
}))
