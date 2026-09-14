import React, { useState } from "react"
import { Alert, TextInput, View } from "react-native"
import Modal from "react-native-modal"

import { gql } from "@apollo/client"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { CONTACT_EMAIL_ADDRESS } from "@app/config"
import { useAccountDeleteMutation, useSettingsScreenQuery } from "@app/graphql/generated"
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useAppConfig } from "@app/hooks"
import useLogout from "@app/hooks/use-logout"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useTheme, Text, makeStyles } from "@rn-vui/themed"

import {
  SwitchProfileOutcome,
  useSwitchToNextProfile,
} from "@app/hooks/use-switch-to-next-profile"

import { SettingsButton } from "../../button"
import { useAccountDeleteContext } from "../account-delete-context"

/** The migration flow closes the emptied custodial account with this same mutation, and
 *  codegen allows one document per operation name, so this one is shared: `code` is what
 *  lets that caller tell a transient refusal from a terminal one. */
gql`
  mutation accountDelete {
    accountDelete {
      errors {
        message
        code
      }
      success
    }
  }
`

export const Delete = () => {
  const styles = useStyles()

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { logout } = useLogout()
  const { appConfig } = useAppConfig()
  const { switchToNextProfile } = useSwitchToNextProfile()

  const { LL } = useI18nContext()

  const [text, setText] = useState("")
  const [modalVisible, setModalVisible] = useState(false)
  const closeModal = () => {
    setModalVisible(false)
    setText("")
  }

  const {
    theme: { colors },
  } = useTheme()

  const { setAccountIsBeingDeleted } = useAccountDeleteContext()

  const [deleteAccount] = useAccountDeleteMutation({ fetchPolicy: "no-cache" })

  const { data, loading } = useSettingsScreenQuery()
  const { formatMoneyAmount } = useDisplayCurrency()

  const btcWallet = getBtcWallet(data?.me?.defaultAccount?.wallets)
  const usdWallet = getUsdWallet(data?.me?.defaultAccount?.wallets)

  const usdWalletBalance = toUsdMoneyAmount(usdWallet?.balance)
  const btcWalletBalance = toBtcMoneyAmount(btcWallet?.balance)

  let usdBalanceWarning = ""
  let btcBalanceWarning = ""
  let balancePositive = false
  if (usdWalletBalance.amount > 0) {
    const balance =
      formatMoneyAmount && formatMoneyAmount({ moneyAmount: usdWalletBalance })
    usdBalanceWarning = LL.AccountScreen.usdBalanceWarning({ balance })
    balancePositive = true
  }

  if (btcWalletBalance.amount > 0) {
    const balance =
      formatMoneyAmount && formatMoneyAmount({ moneyAmount: btcWalletBalance })
    btcBalanceWarning = LL.AccountScreen.btcBalanceWarning({ balance })
    balancePositive = true
  }

  const fullMessage = (
    usdBalanceWarning +
    "\n" +
    btcBalanceWarning +
    "\n" +
    LL.support.deleteAccountBalanceWarning()
  ).trim()

  const deleteAccountAction = async () => {
    if (balancePositive) {
      Alert.alert(LL.common.warning(), fullMessage, [
        { text: LL.common.cancel(), onPress: () => {} },
        {
          text: LL.common.yes(),
          onPress: async () => setModalVisible(true),
        },
      ])
    } else {
      setModalVisible(true)
    }
  }

  /** The deletion hides every way off this screen while it runs; a deletion that did not
   *  happen has to give them back, or the user is left on a dead screen with no exit. */
  const releaseDeletionLock = () => {
    navigation.setOptions({ headerLeft: undefined, gestureEnabled: true })
    setAccountIsBeingDeleted(false)
  }

  const deleteUserAccount = async () => {
    try {
      const accountToDeleteToken = appConfig.token

      navigation.setOptions({
        headerLeft: () => null, // Hides the default back button
        gestureEnabled: false, // Disables swipe to go back gesture
      })
      setAccountIsBeingDeleted(true)

      const res = await deleteAccount()

      if (res.data?.accountDelete?.success) {
        setAccountIsBeingDeleted(false)

        const outcome = await switchToNextProfile(accountToDeleteToken)
        const hasSwitched = outcome === SwitchProfileOutcome.Switched
        if (!hasSwitched) {
          // The logout erases every saved session, which is only correct once
          // we know there is none left. An unreadable store is ignorance, not
          // that knowledge, so keep the list and sign out of everything else.
          // Known cost: the same failed read left the deleted account in that
          // list, so it can still be offered and will 401 once. Cheaper than
          // erasing sessions that were only invisible.
          const isStoreUnreadable = outcome === SwitchProfileOutcome.ProfilesUnreadable
          await logout({
            stateToDefault: true,
            preserveStoredCredentials: isStoreUnreadable,
          })
        }

        Alert.alert(LL.support.bye(), LL.support.deleteAccountConfirmation(), [
          {
            text: LL.common.ok(),
            onPress: () => {
              if (!hasSwitched) {
                navigation.reset({
                  index: 0,
                  routes: [{ name: "getStarted" }],
                })
              }
            },
          },
        ])
      } else {
        /** The server can answer with neither a success nor a rejection, which reading the
         *  first error unguarded turns into a TypeError: the generic alert then replaces the
         *  reason and the hidden back button never comes back. */
        const rejectionMessage = res.data?.accountDelete?.errors?.[0]?.message
        const deleteErrorMessage = LL.support.deleteAccountError({
          email: CONTACT_EMAIL_ADDRESS,
        })

        releaseDeletionLock()
        Alert.alert(
          LL.common.error(),
          rejectionMessage
            ? `${deleteErrorMessage}\n\n${rejectionMessage}`
            : deleteErrorMessage,
        )
      }
    } catch (err) {
      console.error(err)
      releaseDeletionLock()
      Alert.alert(
        LL.common.error(),
        LL.support.deleteAccountError({ email: CONTACT_EMAIL_ADDRESS }),
      )
    }
  }

  const userWroteDelete =
    text.toLowerCase().trim() === LL.support.delete().toLocaleLowerCase().trim()

  const AccountDeletionModal = (
    <Modal
      isVisible={modalVisible}
      onBackdropPress={closeModal}
      backdropOpacity={0.8}
      backdropColor={colors.white}
      avoidKeyboard={true}
    >
      <View style={styles.view}>
        <View style={styles.actionButtons}>
          <Text type="h1" bold>
            {LL.support.deleteAccount()}
          </Text>
          <GaloyIconButton name="close" onPress={closeModal} size={"medium"} />
        </View>
        <Text type="p1">{LL.support.typeDelete({ delete: LL.support.delete() })}</Text>
        <TextInput
          autoCapitalize="none"
          style={styles.textInput}
          onChangeText={setText}
          value={text}
          placeholder={LL.support.delete()}
          placeholderTextColor={colors.grey3}
        />
        <View style={styles.actionButtons}>
          <GaloyPrimaryButton
            title="Confirm"
            disabled={!userWroteDelete}
            onPress={() => {
              closeModal()
              Alert.alert(
                LL.support.finalConfirmationAccountDeletionTitle(),
                LL.support.finalConfirmationAccountDeletionMessage(),
                [
                  { text: LL.common.cancel(), onPress: () => {} },
                  { text: LL.common.ok(), onPress: () => deleteUserAccount() },
                ],
              )
            }}
          />
          <GaloySecondaryButton title="Cancel" onPress={closeModal} />
        </View>
      </View>
    </Modal>
  )

  return (
    <>
      <SettingsButton
        loading={loading}
        title={LL.support.deleteAccount()}
        variant="critical"
        onPress={deleteAccountAction}
      />
      <Text type="p2" bold style={styles.warningText}>
        {LL.support.deleteAccountWarning()}
      </Text>
      {AccountDeletionModal}
    </>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  view: {
    marginHorizontal: 20,
    backgroundColor: colors.grey5,
    padding: 20,
    borderRadius: 20,
    display: "flex",
    flexDirection: "column",
    rowGap: 20,
  },
  textInput: {
    fontSize: 16,
    backgroundColor: colors.grey4,
    padding: 12,
    color: colors.black,
    borderRadius: 8,
  },
  actionButtons: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  warningText: {
    color: colors.primary,
  },
}))
