import React, { useState } from "react"
import { ActivityIndicator, TouchableOpacity, View } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { ListItem, makeStyles, Overlay, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button/galoy-icon-button"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { DeleteAccountConfirmModal } from "@app/screens/settings-screen/self-custodial/delete-account-confirm-modal"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import { type SelfCustodialAccountEntry } from "@app/self-custodial/storage/account-index"
import { AccountType } from "@app/types/wallet.types"
import { testProps } from "@app/utils/testProps"
import { toastShow } from "@app/utils/toast"

import { useDeleteSelfCustodial } from "./hooks/use-delete-self-custodial"

type SelfCustodialProfileRowProps = {
  entry: SelfCustodialAccountEntry
  isFirstItem?: boolean
}

export const SelfCustodialProfileRow: React.FC<SelfCustodialProfileRowProps> = ({
  entry,
  isFirstItem,
}) => {
  const { id: accountId, lightningAddress: persistedLightningAddress } = entry
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { activeAccount, setActiveAccountId } = useAccountRegistry()
  const { lightningAddress: liveLightningAddress } = useSelfCustodialWallet()
  const { state: deleteState, deleteWallet } = useDeleteSelfCustodial()

  const [confirmVisible, setConfirmVisible] = useState(false)

  const isActive =
    activeAccount?.type === AccountType.SelfCustodial && activeAccount.id === accountId
  const lightningAddress = isActive
    ? liveLightningAddress ?? persistedLightningAddress
    : persistedLightningAddress
  const rowTitle = lightningAddress ?? LL.common.anonymousUser()

  const handleSwitch = () => {
    if (isActive) return
    setActiveAccountId(accountId)
    toastShow({
      type: "success",
      message: LL.ProfileScreen.switchAccount(),
      LL,
    })
    navigation.navigate("Primary")
  }

  const handleConfirm = async () => {
    setConfirmVisible(false)
    await deleteWallet(accountId)
  }

  return (
    <>
      <TouchableOpacity
        onPress={handleSwitch}
        {...testProps(`self-custodial-profile-row-${accountId}`)}
      >
        <ListItem
          bottomDivider
          containerStyle={[styles.listStyle, isFirstItem && styles.firstItem]}
        >
          {isActive ? (
            <GaloyIcon name="check-circle" size={20} color={colors._green} />
          ) : (
            <View style={styles.spacer} />
          )}
          <ListItem.Content>
            <ListItem.Title numberOfLines={1} ellipsizeMode="middle">
              {rowTitle}
            </ListItem.Title>
          </ListItem.Content>
          <GaloyIconButton
            name="close"
            size="small"
            onPress={() => setConfirmVisible(true)}
            backgroundColor={colors.grey4}
            {...testProps(`self-custodial-delete-button-${accountId}`)}
          />
        </ListItem>
      </TouchableOpacity>
      <Overlay isVisible={deleteState === "deleting"} overlayStyle={styles.overlayStyle}>
        <ActivityIndicator size={50} color={colors.primary} />
        <Text>{LL.AccountScreen.pleaseWait()}</Text>
      </Overlay>
      <DeleteAccountConfirmModal
        isVisible={confirmVisible}
        onClose={() => setConfirmVisible(false)}
        onConfirm={handleConfirm}
      />
    </>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  listStyle: {
    borderBottomWidth: 2,
    borderColor: colors.grey5,
    backgroundColor: colors.white,
  },
  firstItem: {
    marginTop: 0,
    borderTopWidth: 2,
  },
  spacer: {
    width: 20,
  },
  overlayStyle: {
    backgroundColor: "transparent",
    shadowColor: "transparent",
  },
}))
