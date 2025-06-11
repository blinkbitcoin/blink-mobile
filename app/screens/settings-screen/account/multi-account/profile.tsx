import * as React from "react"
import { ActivityIndicator, TouchableOpacity, View } from "react-native"

import { ListItem, makeStyles, Overlay, useTheme, Text } from "@rneui/themed"
import Icon from "react-native-vector-icons/Ionicons"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useState } from "react"
import { useAppConfig } from "@app/hooks"
import { testProps } from "@app/utils/testProps"
import useLogout from "@app/hooks/use-logout"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button/galoy-icon-button"
import Modal from "react-native-modal"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"

export const ProfileScreen: React.FC<ProfileProps> = ({
  identifier,
  token,
  nextProfileToken,
  selected,
  isFirstItem,
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

  const handleProfileSwitch = async (nextToken?: string) => {
    setSwitchLoading(true)
    await saveToken(nextToken ?? token)

    // Small delay to ensure the new session token is processed and updated in the global state before navigating.
    // This prevents the "Primary" screen from initially loading data using the old session token.
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 100)
    })

    setSwitchLoading(false)
    navigation.navigate("Primary")
  }

  const handleLogout = async () => {
    closeModal()
    setLogoutLoading(true)

    const shouldSwitchProfile = selected && nextProfileToken
    const shouldLogoutAndReset = selected && !nextProfileToken

    if (shouldSwitchProfile) {
      await logout({ stateToDefault: false, token })
      await handleProfileSwitch(nextProfileToken)
      return
    }

    if (shouldLogoutAndReset) {
      await logout()
      navigation.reset({
        index: 0,
        routes: [{ name: "getStarted" }],
      })
      return
    }

    await logout({ stateToDefault: false, token })
    navigation.navigate("Primary")
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
            {identifier}
          </Text>
          <Text type="h1" bold>
            {LL.ProfileScreen.fromThisDevice()}
          </Text>
        </View>
        <View style={styles.actionButtons}>
          <GaloyPrimaryButton
            title="Confirm"
            onPress={async () => {
              await handleLogout()
              setLogoutLoading(false)
            }}
          />
          <GaloySecondaryButton title="Cancel" onPress={closeModal} />
        </View>
      </View>
    </Modal>
  )

  return (
    <>
      <TouchableOpacity
        onPress={async () => {
          await handleProfileSwitch(nextProfileToken)
        }}
        {...testProps(LL.AccountScreen.switchAccount())}
      >
        <ListItem
          bottomDivider
          containerStyle={[styles.listStyle, isFirstItem && styles.firstItem]}
        >
          {selected ? (
            <Icon name="checkmark-circle-outline" size={23} color={colors._green} />
          ) : (
            <View style={styles.spacerStyle} />
          )}
          <ListItem.Content>
            <ListItem.Title>{identifier}</ListItem.Title>
          </ListItem.Content>
          {logoutLoading ? (
            <ActivityIndicator size="large" color={styles.loadingIconColor.color} />
          ) : (
            <GaloyIconButton
              name="close"
              size="medium"
              onPress={openModal}
              backgroundColor={styles.iconColor.color}
            />
          )}
        </ListItem>
      </TouchableOpacity>
      <Overlay isVisible={switchLoading} overlayStyle={styles.overlayStyle}>
        <ActivityIndicator size={50} color={styles.loadingIconColor.color} />
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
  loadingIconColor: {
    color: colors.primary,
  },
  spacerStyle: {
    width: 23,
  },
  iconColor: {
    color: colors.grey5,
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
