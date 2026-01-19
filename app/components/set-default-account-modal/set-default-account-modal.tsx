import React from "react"
import { View, TouchableOpacity, ActivityIndicator } from "react-native"
import { ScrollView } from "react-native-gesture-handler"
import Modal from "react-native-modal"

import { gql, useApolloClient } from "@apollo/client"
import { setHasPromptedSetDefaultAccount } from "@app/graphql/client-only-query"
import {
  WalletCurrency,
  useAccountUpdateDefaultWalletIdMutation,
  useSetDefaultAccountModalQuery,
} from "@app/graphql/generated"
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import { useI18nContext } from "@app/i18n/i18n-react"
import crashlytics from "@react-native-firebase/crashlytics"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { CurrencyPill } from "../atomic/currency-pill"
import { GaloyIconButton } from "../atomic/galoy-icon-button"

gql`
  query setDefaultAccountModal {
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

export type SetDefaultAccountModalProps = {
  isVisible: boolean
  toggleModal: () => void
}

export const SetDefaultAccountModal = ({
  isVisible,
  toggleModal,
}: SetDefaultAccountModalProps) => {
  const [btcLoading, setBtcLoading] = React.useState(false)
  const [usdLoading, setUsdLoading] = React.useState(false)

  const [accountUpdateDefaultWallet] = useAccountUpdateDefaultWalletIdMutation()

  const { data } = useSetDefaultAccountModalQuery({
    fetchPolicy: "cache-only",
  })

  const client = useApolloClient()

  const usdWallet = getUsdWallet(data?.me?.defaultAccount?.wallets)
  const btcWallet = getBtcWallet(data?.me?.defaultAccount?.wallets)

  const onPressUsdAccount = async () => {
    setUsdLoading(true)
    if (usdWallet) {
      try {
        await accountUpdateDefaultWallet({
          variables: {
            input: {
              walletId: usdWallet.id,
            },
          },
        })
      } catch (err) {
        if (err instanceof Error) {
          crashlytics().recordError(err)
        }
      }
    }
    setUsdLoading(false)

    setHasPromptedSetDefaultAccount(client)
    toggleModal()
  }

  const onPressBtcAccount = async () => {
    setBtcLoading(true)
    if (btcWallet) {
      try {
        await accountUpdateDefaultWallet({
          variables: {
            input: {
              walletId: btcWallet.id,
            },
          },
        })
      } catch (err) {
        if (err instanceof Error) {
          crashlytics().recordError(err)
        }
      }
    }
    setBtcLoading(false)

    setHasPromptedSetDefaultAccount(client)
    toggleModal()
  }

  return (
    <SetDefaultAccountModalUI
      loadingUsdAccount={usdLoading}
      loadingBtcAccount={btcLoading}
      isVisible={isVisible}
      toggleModal={toggleModal}
      onPressBtcAccount={onPressBtcAccount}
      onPressUsdAccount={onPressUsdAccount}
    />
  )
}

export type SetDefaultAccountModalUIProps = {
  isVisible: boolean
  toggleModal: () => void
  onPressUsdAccount?: () => void
  loadingUsdAccount?: boolean
  loadingBtcAccount?: boolean
  onPressBtcAccount?: () => void
}

export const SetDefaultAccountModalUI: React.FC<SetDefaultAccountModalUIProps> = ({
  isVisible,
  toggleModal,
  onPressUsdAccount,
  onPressBtcAccount,
  loadingBtcAccount,
  loadingUsdAccount,
}) => {
  const styles = useStyles()
  const {
    theme: { mode, colors },
  } = useTheme()
  const { LL } = useI18nContext()

  return (
    <Modal
      isVisible={isVisible}
      backdropOpacity={0.8}
      backdropColor={colors.white}
      backdropTransitionOutTiming={0}
      avoidKeyboard={true}
      onBackdropPress={toggleModal}
      onBackButtonPress={toggleModal}
    >
      <View style={styles.container}>
        <GaloyIconButton
          style={styles.closeIcon}
          name="close"
          size="medium"
          color={colors.grey0}
          onPress={toggleModal}
        />
        <ScrollView
          style={styles.modalCard}
          persistentScrollbar={true}
          indicatorStyle={mode === "dark" ? "white" : "black"}
          bounces={false}
          contentContainerStyle={styles.scrollViewContainer}
        >
          <View style={styles.modalTitleContainer}>
            <Text style={styles.modalTitleText}>{LL.SetAccountModal.title()}</Text>
          </View>
          <View style={styles.modalBodyContainer}>
            <Text type={"p1"} style={styles.modalBodyText}>
              {LL.SetAccountModal.description()}
            </Text>
          </View>
        </ScrollView>
        <View style={styles.modalActionsContainer}>
          <TouchableOpacity onPress={onPressBtcAccount}>
            <View style={styles.currencyButtonContainer}>
              {loadingBtcAccount ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <CurrencyPill currency={WalletCurrency.Btc} containerSize="medium" />
                  <View style={styles.currencyButtonTextContainer}>
                    <Text type="p2" style={styles.currencyButtonText}>
                      {LL.SetAccountModal.bitcoinTag()}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={onPressUsdAccount}>
            <View style={styles.currencyButtonContainer}>
              {loadingUsdAccount ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <CurrencyPill currency={WalletCurrency.Usd} containerSize="medium" />
                  <View style={styles.currencyButtonTextContainer}>
                    <Text type="p2" style={styles.currencyButtonText}>
                      {LL.SetAccountModal.stablesatsTag()}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  currencyButtonContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: colors.grey4,
    minHeight: 90,
    borderRadius: 12,
    columnGap: 12,
    justifyContent: "center",
  },
  currencyButtonTextContainer: {
    flex: 1,
    flexDirection: "column",
  },
  currencyButtonText: {
    color: colors.black,
    fontWeight: "400",
    lineHeight: 22,
  },
  container: {
    backgroundColor: colors.grey5,
    maxHeight: "80%",
    minHeight: "auto",
    borderRadius: 16,
    padding: 20,
  },
  modalCard: {
    width: "100%",
  },
  modalTitleContainer: {
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitleText: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 32,
    maxWidth: "80%",
    textAlign: "center",
    color: colors.black,
    marginBottom: 10,
  },
  modalBodyContainer: {
    flex: 1,
    flexGrow: 1,
  },
  scrollViewContainer: { flexGrow: 1 },
  modalBodyText: {
    textAlign: "center",
    color: colors.black,
  },
  modalActionsContainer: {
    width: "100%",
    height: "auto",
    flexDirection: "column",
    rowGap: 12,
    marginTop: 20,
  },
  closeIcon: {
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
}))
