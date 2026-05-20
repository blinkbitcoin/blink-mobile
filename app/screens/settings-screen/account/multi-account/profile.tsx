import * as React from "react"
import { ActivityIndicator, TouchableOpacity, View } from "react-native"

import { ListItem, makeStyles, Overlay, useTheme, Text } from "@rn-vui/themed"
import { useI18nContext } from "@app/i18n/i18n-react"
import { CommonActions, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useState } from "react"
import { useAppConfig } from "@app/hooks"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { testProps } from "@app/utils/testProps"
import useLogout from "@app/hooks/use-logout"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button/galoy-icon-button"
import Modal from "react-native-modal"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { DefaultAccountId, AccountType } from "@app/types/wallet"
import { toastShow } from "@app/utils/toast"

export const ProfileScreen: React.FC<ProfileProps> = ({
  identifier,
  token,
  nextProfileToken,
  selected,
  isFirstItem,
  hasUsername,
  lnAddressHostname,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const { LL } = useI18nContext()

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const [switchLoading, setSwitchLoading] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)

  const { saveToken } = useAppConfig()
  const { logout } = useLogout()
  const { accounts, activeAccount, setActiveAccountId } = useAccountRegistry()
  const isCurrentlyActive = selected && activeAccount?.type === AccountType.Custodial

  const handleProfileSwitch = async (nextToken?: string) => {
    setSwitchLoading(true)
    await saveToken(nextToken || token)
    setActiveAccountId(DefaultAccountId.Custodial)

    setSwitchLoading(false)
    toastShow({
      type: "success",
      message: LL.ProfileScreen.switchAccount(),
      LL,
    })
    navigation.navigate("Primary")
  }

  const fallbackSelfCustodial = accounts.find((a) => a.type === AccountType.SelfCustodial)

  type LogoutStrategy =
    | { kind: "switchToOtherCustodial"; nextToken: string }
    | { kind: "fallbackToSelfCustodial"; selfCustodialId: string }
    | { kind: "resetToLaunch" }
    | { kind: "removeInactive" }

  const resolveLogoutStrategy = (): LogoutStrategy => {
    if (!isCurrentlyActive) return { kind: "removeInactive" }
    if (nextProfileToken) {
      return { kind: "switchToOtherCustodial", nextToken: nextProfileToken }
    }
    if (fallbackSelfCustodial) {
      return {
        kind: "fallbackToSelfCustodial",
        selfCustodialId: fallbackSelfCustodial.id,
      }
    }
    return { kind: "resetToLaunch" }
  }

  const handleLogout = async () => {
    closeModal()
    setLogoutLoading(true)

    const strategy = resolveLogoutStrategy()

    switch (strategy.kind) {
      case "switchToOtherCustodial":
        await logout({ stateToDefault: false, token })
        await handleProfileSwitch(strategy.nextToken)
        toastShow({
          type: "success",
          message: LL.ProfileScreen.removedAccount({ identifier }),
          LL,
        })
        return
      case "fallbackToSelfCustodial":
        setActiveAccountId(strategy.selfCustodialId)
        await saveToken("")
        navigation.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }),
        )
        logout({ stateToDefault: false, token }).catch(() => {})
        return
      case "resetToLaunch":
        await logout()
        navigation.reset({ index: 0, routes: [{ name: "getStarted" }] })
        return
      case "removeInactive":
        await logout({ stateToDefault: false, token })
        navigation.navigate("Primary")
    }
  }

  const closeModal = () => {
    setModalVisible(false)
  }

  const openModal = () => {
    setModalVisible(true)
  }

  const logoutModal = (
    <Modal
      animationOut="fadeOut"
      animationIn="fadeIn"
      isVisible={modalVisible}
      onBackdropPress={closeModal}
      backdropColor={colors.white}
      avoidKeyboard={true}
      backdropTransitionOutTiming={0}
    >
      <View style={styles.modalView}>
        <View style={styles.modalText}>
          <Text type="h1" bold>
            {LL.common.logout()}
          </Text>
          <Text type="h1" bold>
            {hasUsername ? `${identifier}@${lnAddressHostname}` : identifier}
          </Text>
          <Text type="h1" bold>
            {LL.ProfileScreen.fromThisDevice()}
          </Text>
        </View>
        <View style={styles.actionButtons}>
          <GaloyPrimaryButton
            title={LL.common.confirm()}
            onPress={async () => {
              await handleLogout()
              setLogoutLoading(false)
            }}
          />
          <GaloySecondaryButton title={LL.common.cancel()} onPress={closeModal} />
        </View>
      </View>
    </Modal>
  )

  return (
    <>
      <TouchableOpacity
        onPress={() => handleProfileSwitch()}
        {...testProps(LL.AccountScreen.switchAccount())}
      >
        <ListItem
          bottomDivider
          containerStyle={[styles.listStyle, isFirstItem && styles.firstItem]}
        >
          {isCurrentlyActive ? (
            <GaloyIcon name="check-circle" size={20} color={colors._green} />
          ) : (
            <View style={styles.spacerStyle} />
          )}
          <ListItem.Content>
            <ListItem.Title>
              {hasUsername ? `${identifier}@${lnAddressHostname}` : identifier}
            </ListItem.Title>
            <Text type="p3" style={styles.subtitle}>
              {LL.AccountTypeSelectionScreen.custodialLabel()}
            </Text>
          </ListItem.Content>
          {logoutLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <GaloyIconButton
              name="close"
              size="small"
              onPress={openModal}
              backgroundColor={colors.grey4}
            />
          )}
        </ListItem>
      </TouchableOpacity>
      <Overlay isVisible={switchLoading} overlayStyle={styles.overlayStyle}>
        <ActivityIndicator size={50} color={colors.primary} />
        <Text>{LL.AccountScreen.pleaseWait()}</Text>
      </Overlay>
      {logoutModal}
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
  overlayStyle: {
    backgroundColor: "transparent",
    shadowColor: "transparent",
  },
  spacerStyle: {
    width: 20,
  },
  subtitle: {
    color: colors.grey2,
  },
  modalView: {
    marginHorizontal: 20,
    backgroundColor: colors.grey5,
    padding: 20,
    borderRadius: 20,
    display: "flex",
    flexDirection: "column",
    rowGap: 20,
  },
  actionButtons: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalText: {
    display: "flex",
    flexDirection: "column",
    rowGap: 2,
  },
}))
