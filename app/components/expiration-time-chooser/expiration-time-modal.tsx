import * as React from "react"
import { SafeAreaView, View } from "react-native"
import ReactNativeModal from "react-native-modal"

import { timing } from "@app/rne-theme/timing"
import { ListItem, makeStyles, useTheme, Text } from "@rn-vui/themed"
import Icon from "react-native-vector-icons/Ionicons"
import { GaloyIconButton } from "../atomic/galoy-icon-button"
import { WalletCurrency } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"

export type ExpirationTimeModalProps = {
  value?: string | number
  walletCurrency: WalletCurrency
  onSetExpirationTime?: (expirationTime: number) => void
  isOpen: boolean
  close: () => void
}

export const ExpirationTimeModal: React.FC<ExpirationTimeModalProps> = ({
  value,
  onSetExpirationTime,
  walletCurrency,
  isOpen,
  close,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const { LL } = useI18nContext()

  const btcExpirationList = [
    {
      name: `24 ${LL.common.hours()}`,
      minutes: 24 * 60, // 1440
    },
    {
      name: `12 ${LL.common.hours()}`,
      minutes: 12 * 60, // 720
    },
    {
      name: `4 ${LL.common.hours()}`,
      minutes: 4 * 60, // 240
    },
    {
      name: `1 ${LL.common.hour()}`,
      minutes: 60,
    },
  ]

  const usdExpirationList = [
    {
      name: `5 ${LL.common.minutes()}`,
      minutes: 5,
    },
  ]
  const expirationList = walletCurrency === "USD" ? usdExpirationList : btcExpirationList

  return (
    <ReactNativeModal
      isVisible={isOpen}
      coverScreen={true}
      style={styles.modal}
      animationInTiming={timing.quick}
    >
      <SafeAreaView style={styles.amountInputScreenContainer}>
        <View style={styles.headerContainer}>
          <Text type={"h1"}>{LL.common.expirationTime()}</Text>
          <GaloyIconButton iconOnly={true} size={"medium"} name="close" onPress={close} />
        </View>
        {expirationList.map(({ name, minutes }, index) => (
          <ListItem
            key={index}
            onPress={() => (onSetExpirationTime ? onSetExpirationTime(minutes) : null)}
            bottomDivider
          >
            {value === minutes ? (
              <Icon name="checkmark-circle" size={18} color={colors._green} />
            ) : (
              <View style={styles.emptySpacer} />
            )}
            <ListItem.Content>
              <ListItem.Title>{name}</ListItem.Title>
            </ListItem.Content>
          </ListItem>
        ))}
      </SafeAreaView>
    </ReactNativeModal>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  amountInputScreenContainer: {
    flex: 1,
  },
  modal: {
    backgroundColor: colors.white,
    margin: 0,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomColor: colors.primary4,
    borderBottomWidth: 1,
  },
  emptySpacer: {
    width: 18,
  },
}))
